import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import {
  S3Client,
  PutObjectCommand,
  ObjectCannedACL,
} from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

// This config is no longer needed in App Router for file uploads
// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    // Enforce authentication
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the form data using the new FormData API
    const formData = await req.formData();

    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type - allow images and PDFs
    const allowedTypes = [
      "image/jpeg",
      "image/png", 
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only image files (jpg, png, gif, webp, svg) and PDF files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size - max 10MB for PDFs, 5MB for images
    const maxSize = file.type === "application/pdf" ? 10 * 1024 * 1024 : 5 * 1024 * 1024; // 10MB for PDF, 5MB for images
    if (file.size > maxSize) {
      const sizeLimit = file.type === "application/pdf" ? "10MB" : "5MB";
      return NextResponse.json(
        { error: `File size exceeds the ${sizeLimit} limit` },
        { status: 400 }
      );
    }

    // Get file data as ArrayBuffer
    const fileArrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(fileArrayBuffer);

    // Get file extension from original file name
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${randomUUID()}.${fileExt}`;

    // Setup S3 client for DigitalOcean Spaces

    // DO_SPACES_ENDPOINT should be https://sfo3.digitaloceanspaces.com
    // NOT https://bageledu.sfo3.digitaloceanspaces.com (which includes bucket)
    let endpoint = process.env.DO_SPACES_ENDPOINT || "";
    const bucket = process.env.DO_SPACES_BUCKET || "";

    // Check if endpoint contains bucket name and remove it
    if (endpoint.includes(`${bucket}.`)) {
      endpoint = endpoint.replace(`https://${bucket}.`, "https://");
    }

    // Extract region from endpoint URL if region is not properly set
    let region = process.env.DO_SPACES_REGION;
    if (!region || region === "your-region") {
      // Extract region from endpoint URL (e.g., https://sfo3.digitaloceanspaces.com -> sfo3)
      const matches = endpoint.match(
        /https:\/\/([^.]+)\.digitaloceanspaces\.com/
      );
      region = matches && matches[1] ? matches[1] : "sfo3"; // Default to sfo3 if extraction fails
    }

    const s3 = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: process.env.DO_SPACES_KEY!,
        secretAccessKey: process.env.DO_SPACES_SECRET!,
      },
      forcePathStyle: false,
    });

    const uploadParams = {
      Bucket: bucket,
      Key: fileName,
      Body: fileBuffer,
      ACL: "public-read" as ObjectCannedACL,
      ContentType: file.type || "application/octet-stream",
    };

    try {
      await s3.send(new PutObjectCommand(uploadParams));

      // Format URL with correct region - important to avoid certificate errors
      // The correct format is: https://<bucket>.<region>.digitaloceanspaces.com/<fileName>
      // The endpoint domain should be just: <region>.digitaloceanspaces.com

      const url = `https://${bucket}.${region}.digitaloceanspaces.com/${fileName}`;

      // Double-check for certificate errors before returning
      if (url.includes(`${bucket}.${bucket}`)) {
        const correctedUrl = url.replace(`${bucket}.${bucket}`, bucket);
        return NextResponse.json({ url: correctedUrl }, { status: 200 });
      }

      return NextResponse.json({ url }, { status: 200 });
    } catch (e: any) {
      return NextResponse.json(
        { error: "Upload failed", details: e.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error processing upload", details: error.message },
      { status: 500 }
    );
  }
}
