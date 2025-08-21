import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

// Helper function to sanitize filenames for storage
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user?.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Create authenticated Supabase client
    const supabase = await createClient();

    const formData = await req.formData();
    const file = (formData.get("file") || formData.get("image")) as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Only image files (JPEG, PNG, WebP, GIF, SVG) and PDF files are allowed.",
        },
        { status: 400 }
      );
    }

    // Validate file size (20MB limit for processing, 10MB for PDFs)
    const maxSize =
      file.type === "application/pdf" ? 10 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxSize) {
      const sizeLimit = file.type === "application/pdf" ? "10MB" : "20MB";
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${sizeLimit}.`,
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const fileBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(fileBuffer);

    const uploadResults: any[] = [];
    let metadata = null;

    // Handle PDF files differently than images
    if (file.type === "application/pdf") {
      // For PDFs, upload directly without optimization
      const sanitizedName = sanitizeFileName(file.name);

      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}-${sanitizedName}`;

      const { error } = await supabase.storage
        .from("image-assets")
        .upload(fileName, buffer, {
          contentType: file.type,
          cacheControl: "31536000", // 1 year cache
        });

      if (error) {
        throw new Error(`PDF upload failed: ${error.message}`);
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("image-assets").getPublicUrl(fileName);

      uploadResults.push({
        name: file.name,
        url: publicUrl,
        size: file.size,
        width: null,
        height: null,
        format: "pdf",
        quality: null,
      });
    } else {
      // Handle images with optimization
      metadata = await sharp(buffer).metadata();

      // Determine optimal formats and sizes
      const optimizedImages = await createOptimizedImages(
        buffer,
        file.name,
        metadata
      );

      // Upload all optimized versions to Supabase
      for (const optimized of optimizedImages) {
        const sanitizedName = sanitizeFileName(optimized.name);

        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2)}-${sanitizedName}`;

        const { error } = await supabase.storage
          .from("image-assets")
          .upload(fileName, optimized.buffer, {
            contentType: optimized.contentType,
            cacheControl: "31536000", // 1 year cache
          });

        if (error) {
          throw new Error(
            `Upload failed for ${optimized.name}: ${error.message}`
          );
        }

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("image-assets").getPublicUrl(fileName);

        uploadResults.push({
          name: optimized.name,
          url: publicUrl,
          size: optimized.size,
          width: optimized.width,
          height: optimized.height,
          format: optimized.format,
          quality: optimized.quality,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message:
        file.type === "application/pdf"
          ? "PDF uploaded successfully"
          : "File processed and uploaded successfully",
      original: {
        name: file.name,
        size: file.size,
        width: file.type === "application/pdf" ? null : metadata?.width,
        height: file.type === "application/pdf" ? null : metadata?.height,
        format: file.type === "application/pdf" ? "pdf" : metadata?.format,
      },
      optimized: uploadResults,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Upload failed: " + (error.message || "Unknown error"),
      },
      { status: 500 }
    );
  }
}

async function createOptimizedImages(
  buffer: Buffer,
  originalName: string,
  metadata: any
) {
  const baseName = originalName.replace(/\.[^/.]+$/, "");
  const optimizedImages = [];

  // Original dimensions
  const originalWidth = metadata.width || 0;

  // Define size variants with responsive breakpoints
  const sizeVariants = [
    { name: "thumbnail", width: 300, quality: 80 },
    { name: "small", width: 600, quality: 85 },
    { name: "medium", width: 1200, quality: 85 },
    { name: "large", width: 1920, quality: 90 },
    { name: "original", width: originalWidth, quality: 95 },
  ];

  // Filter out variants larger than original
  const validVariants = sizeVariants.filter(
    (variant) => variant.width <= originalWidth || variant.name === "original"
  );

  for (const variant of validVariants) {
    // WebP version (best compression)
    const webpBuffer = await sharp(buffer)
      .resize(variant.width, null, {
        withoutEnlargement: true,
        fit: "inside",
      })
      .webp({ quality: variant.quality, effort: 6 })
      .toBuffer();

    const webpMetadata = await sharp(webpBuffer).metadata();

    optimizedImages.push({
      name: `${baseName}-${variant.name}.webp`,
      buffer: webpBuffer,
      contentType: "image/webp",
      size: webpBuffer.length,
      width: webpMetadata.width,
      height: webpMetadata.height,
      format: "webp",
      quality: variant.quality,
    });

    // JPEG version (better compatibility)
    if (metadata.format !== "webp") {
      const jpegBuffer = await sharp(buffer)
        .resize(variant.width, null, {
          withoutEnlargement: true,
          fit: "inside",
        })
        .jpeg({ quality: variant.quality, progressive: true })
        .toBuffer();

      const jpegMetadata = await sharp(jpegBuffer).metadata();

      optimizedImages.push({
        name: `${baseName}-${variant.name}.jpg`,
        buffer: jpegBuffer,
        contentType: "image/jpeg",
        size: jpegBuffer.length,
        width: jpegMetadata.width,
        height: jpegMetadata.height,
        format: "jpeg",
        quality: variant.quality,
      });
    }
  }

  return optimizedImages;
}

// GET endpoint to list uploaded images
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user?.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Create authenticated Supabase client
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from("image-assets")
      .list("", {
        limit: 100,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      throw new Error(`Failed to list images: ${error.message}`);
    }

    const images =
      data?.map((file) => {
        const {
          data: { publicUrl },
        } = supabase.storage.from("image-assets").getPublicUrl(file.name);

        return {
          name: file.name,
          url: publicUrl,
          size: file.metadata?.size || 0,
          created: file.created_at,
          updated: file.updated_at,
        };
      }) || [];

    return NextResponse.json({
      success: true,
      images,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to list images: " + (error.message || "Unknown error"),
      },
      { status: 500 }
    );
  }
}

// DELETE endpoint to remove images
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user?.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Create authenticated Supabase client
    const supabase = await createClient();

    const { fileName } = await req.json();

    if (!fileName) {
      return NextResponse.json(
        { error: "File name is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.storage
      .from("image-assets")
      .remove([fileName]);

    if (error) {
      throw new Error(`Failed to delete image: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to delete image: " + (error.message || "Unknown error"),
      },
      { status: 500 }
    );
  }
}
