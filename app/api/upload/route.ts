import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { S3Client, PutObjectCommand, ObjectCannedACL } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

// This config is no longer needed in App Router for file uploads
// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

export async function POST(req: NextRequest) {
  console.log("POST request received at /api/upload");
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    console.log("Auth session:", session ? {
      user: session.user ? {
        name: session.user.name,
        email: session.user.email,
      } : "No user in session",
      expires: session.expires
    } : "No session");
    
    // Enforce authentication
    if (!session) {
      console.log("Authentication failed - unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("Authentication successful");

    // Get the form data using the new FormData API
    console.log("Attempting to parse form data...");
    const formData = await req.formData();
    console.log("FormData keys:", [...formData.keys()]);
    
    const file = formData.get('image') as File | null;
    
    if (!file) {
      console.log("No file found in the request");
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    
    console.log("File received:", { 
      name: file.name, 
      type: file.type, 
      size: file.size + " bytes" 
    });

    // Validate file type - only allow images
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      console.log(`File type not allowed: ${file.type}`);
      return NextResponse.json({ error: "Only image files are allowed (jpg, png, gif, webp, svg)" }, { status: 400 });
    }
    
    // Validate file size - max 5MB
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      console.log(`File too large: ${file.size} bytes (max: ${maxSize} bytes)`);
      return NextResponse.json({ error: "File size exceeds the 5MB limit" }, { status: 400 });
    }

    // Get file data as ArrayBuffer
    console.log("Reading file content...");
    const fileArrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(fileArrayBuffer);
    console.log("File content read successfully, size:", fileBuffer.length);
    
    // Get file extension from original file name
    const fileExt = file.name.split('.').pop() || "jpg";
    const fileName = `${randomUUID()}.${fileExt}`;
    console.log("Generated file name:", fileName);

    // Setup S3 client for DigitalOcean Spaces
    console.log("Setting up S3 client for DigitalOcean Spaces...");
    
    // DO_SPACES_ENDPOINT should be https://sfo3.digitaloceanspaces.com
    // NOT https://bageledu.sfo3.digitaloceanspaces.com (which includes bucket)
    let endpoint = process.env.DO_SPACES_ENDPOINT || "";
    const bucket = process.env.DO_SPACES_BUCKET || "";
    
    // Check if endpoint contains bucket name and remove it
    if (endpoint.includes(`${bucket}.`)) {
      console.log(`Endpoint configuration adjusted for security`);
      endpoint = endpoint.replace(`https://${bucket}.`, 'https://');
    }
    
    // Securely log configuration without exposing specifics
    console.log("Storage service configuration validated");
    
    // Extract region from endpoint URL if region is not properly set
    let region = process.env.DO_SPACES_REGION;
    if (!region || region === 'your-region') {
      // Extract region from endpoint URL (e.g., https://sfo3.digitaloceanspaces.com -> sfo3)
      const matches = endpoint.match(/https:\/\/([^.]+)\.digitaloceanspaces\.com/);
      region = matches && matches[1] ? matches[1] : 'sfo3'; // Default to sfo3 if extraction fails
      console.log("Region parameter adjusted");
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
    console.log("S3 client created");

    const uploadParams = {
      Bucket: bucket,
      Key: fileName,
      Body: fileBuffer,
      ACL: "public-read" as ObjectCannedACL,
      ContentType: file.type || "application/octet-stream",
    };
    console.log("Upload parameters prepared");

    try {
      console.log("Uploading file to DigitalOcean Spaces...");
      await s3.send(new PutObjectCommand(uploadParams));
      console.log("File uploaded successfully");
      
      // Format URL with correct region - important to avoid certificate errors
      // The correct format is: https://<bucket>.<region>.digitaloceanspaces.com/<fileName>
      // The endpoint domain should be just: <region>.digitaloceanspaces.com
      
      const url = `https://${bucket}.${region}.digitaloceanspaces.com/${fileName}`;
      console.log("Generated URL:", url);
      
      // Double-check for certificate errors before returning
      if (url.includes(`${bucket}.${bucket}`)) {
        console.error("WARNING: Malformed URL detected with double bucket name");
        const correctedUrl = url.replace(`${bucket}.${bucket}`, bucket);
        console.log("Corrected URL:", correctedUrl);
        return NextResponse.json({ url: correctedUrl }, { status: 200 });
      }
      
      return NextResponse.json({ url }, { status: 200 });
    } catch (e: any) {
      console.error("Upload error details:", {
        message: e.message,
        code: e.code,
        name: e.name,
        stack: e.stack
      });
      return NextResponse.json({ error: "Upload failed", details: e.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error("General error in upload route:", error);
    return NextResponse.json({ error: "Error processing upload", details: error.message }, { status: 500 });
  }
} 