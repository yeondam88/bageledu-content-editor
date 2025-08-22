import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Generate a random short code
function generateShortCode(): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Validate URL format
function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch {
    return false;
  }
}

// Extract title from URL (basic implementation)
async function extractTitleFromUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return new URL(url).hostname;
  } catch {
    return new URL(url).hostname;
  }
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

    const { originalUrl, customCode, title, expiresIn } = await req.json();

    // Validate input
    if (!originalUrl || typeof originalUrl !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (!isValidUrl(originalUrl)) {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Validate custom code if provided
    if (customCode) {
      if (!/^[a-zA-Z0-9_-]{3,10}$/.test(customCode)) {
        return NextResponse.json(
          {
            error:
              "Custom code must be 3-10 characters (letters, numbers, _, -)",
          },
          { status: 400 }
        );
      }
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

    let shortCode = customCode;
    let attempts = 0;
    const maxAttempts = 10;

    // Generate unique short code
    while (!shortCode && attempts < maxAttempts) {
      const candidate = generateShortCode();

      // Check if code already exists
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

    // Check if custom code already exists
    if (customCode) {
      const { data: existing } = await supabase
        .from("urls")
        .select("id")
        .eq("short_code", customCode)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: "Custom code already exists" },
          { status: 409 }
        );
      }
    }

    // Calculate expiration date
    let expiresAt = null;
    if (expiresIn && typeof expiresIn === "number" && expiresIn > 0) {
      expiresAt = new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000); // days to milliseconds
    }

    // Extract or use provided title
    const urlTitle = title || (await extractTitleFromUrl(originalUrl));

    // Insert into database
    const { data, error } = await supabase
      .from("urls")
      .insert({
        original_url: originalUrl,
        short_code: shortCode,
        user_email: session.user.email,
        title: urlTitle,
        expires_at: expiresAt,
        custom_code: !!customCode,
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
        clicks: data.clicks,
        createdAt: data.created_at,
        expiresAt: data.expires_at,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Shorten URL error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to list user's URLs
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user?.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createClient();

    // Set user email in Postgres session for RLS
    await supabase
      .rpc("set_config", {
        setting_name: "app.current_user_email",
        setting_value: session.user.email,
        is_local: true,
      })
      .then(() => {})
      .catch(() => {});

    const { data, error } = await supabase
      .from("urls")
      .select("*")
      .eq("user_email", session.user.email)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch URLs" },
        { status: 500 }
      );
    }

    // Get the current domain from the request
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;

    // Format response
    const urls = data.map((url) => ({
      id: url.id,
      originalUrl: url.original_url,
      shortCode: url.short_code,
      shortUrl: `${baseUrl}/s/${url.short_code}`,
      title: url.title,
      clicks: url.clicks,
      createdAt: url.created_at,
      expiresAt: url.expires_at,
      isActive: url.is_active,
      customCode: url.custom_code,
    }));

    return NextResponse.json({ urls });
  } catch (error: unknown) {
    console.error("List URLs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
