import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { createClient } from "@/utils/supabase/server";

// Helper function to generate a short code
function generateShortCode(): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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

    const { assetUrl, fileName } = await req.json();

    // Validate input
    if (!assetUrl || typeof assetUrl !== "string") {
      return NextResponse.json(
        { error: "Asset URL is required" },
        { status: 400 }
      );
    }

    // Create Supabase client and set user context
    const supabase = await createClient();

    // Set user email in Postgres session for RLS
    await supabase
      .rpc("set_config", {
        setting_name: "app.current_user_email",
        setting_value: session.user.email,
        is_local: true,
      })
      .then(() => {})
      .catch(() => {}); // Ignore if function doesn't exist

    let shortCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    // Generate unique short code
    while (attempts < maxAttempts) {
      const candidate = generateShortCode();

      // Check if this code already exists
      const { data: existing } = await supabase
        .from("urls")
        .select("id")
        .eq("short_code", candidate)
        .single();

      if (!existing) {
        shortCode = candidate;
        break;
      }

      attempts++;
    }

    if (!shortCode) {
      return NextResponse.json(
        { error: "Failed to generate unique short code" },
        { status: 500 }
      );
    }

    // Use filename as title, clean it up
    const title = fileName
      ? fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ")
      : "Asset";

    // Insert into database (no expiration for assets)
    const { data, error } = await supabase
      .from("urls")
      .insert({
        original_url: assetUrl,
        short_code: shortCode,
        user_email: session.user.email,
        title: `Asset: ${title}`,
        expires_at: null, // Never expires
        custom_code: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to create short URL" },
        { status: 500 }
      );
    }

    // Get the current domain from the request
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;

    // Return the created short URL
    return NextResponse.json(
      {
        id: data.id,
        originalUrl: data.original_url,
        shortCode: data.short_code,
        shortUrl: `${baseUrl}/s/${data.short_code}`,
        title: data.title,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Auto-shorten error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
