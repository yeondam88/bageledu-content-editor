import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

interface RouteProps {
  params: {
    code: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteProps) {
  try {
    // Await params in Next.js 15+
    const { code } = await params;

    if (!code) {
      return NextResponse.json({ error: "Invalid code" }, { status: 404 });
    }

    const supabase = await createClient();

    // Get the URL from database
    const { data: urlData, error } = await supabase
      .from("urls")
      .select("id, original_url, is_active, expires_at")
      .eq("short_code", code)
      .single();

    if (error || !urlData) {
      return NextResponse.json({ error: "URL not found" }, { status: 404 });
    }

    // Check if URL is active
    if (!urlData.is_active) {
      return NextResponse.json({ error: "URL is inactive" }, { status: 404 });
    }

    // Check if URL has expired
    if (urlData.expires_at && new Date(urlData.expires_at) < new Date()) {
      return NextResponse.json({ error: "URL has expired" }, { status: 404 });
    }

    // Get request headers for analytics (await headers in Next.js 15+)
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || "";
    const referer = headersList.get("referer") || "";
    const forwardedFor = headersList.get("x-forwarded-for") || "";

    // Track the click asynchronously (don't wait for it)
    const trackClick = async () => {
      try {
        // Increment click count
        await supabase.rpc("increment_url_clicks", { url_short_code: code });

        // Log detailed click data
        await supabase.from("url_clicks").insert({
          url_id: urlData.id,
          user_agent: userAgent,
          referer: referer,
          ip_address: forwardedFor.split(",")[0]?.trim() || null,
        });
      } catch (error) {
        console.error("Failed to track click:", error);
      }
    };

    // Track click in background
    trackClick();

    // Return redirect response
    return NextResponse.redirect(urlData.original_url, { status: 307 });
  } catch (error) {
    console.error("Redirect error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
