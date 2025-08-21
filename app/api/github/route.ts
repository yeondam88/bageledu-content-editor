import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { markdown, path, message } = body;

    if (!markdown || !path || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Extract the image URL from markdown
    const imageUrlMatch =
      markdown.match(/image:\s*\n\s*src:\s*'([^']*)'/) ||
      markdown.match(/image:\s*\n\s*src:\s*''/);
    const imageUrl =
      imageUrlMatch && imageUrlMatch[1]
        ? imageUrlMatch[1]
        : "No image URL found";

    // Check if image URL is empty or missing
    if (!imageUrl || imageUrl === "No image URL found" || imageUrl === "") {
      return NextResponse.json(
        { error: "Image URL is required in the markdown frontmatter" },
        { status: 400 }
      );
    }

    // Validate that the image exists by making a HEAD request
    try {
      const imageCheck = await fetch(imageUrl, { method: "HEAD" });
      if (!imageCheck.ok) {
        return NextResponse.json(
          {
            error: `Image not found at the specified URL (Status: ${imageCheck.status})`,
          },
          { status: 400 }
        );
      }
    } catch (error: any) {
      // We'll continue anyway, as sometimes HEAD requests can fail for valid images due to CORS
    }

    // Ensure image URL has proper region format for DigitalOcean Spaces
    let markdownToUse = markdown;
    if (imageUrl.includes("digitaloceanspaces.com")) {
      const urlParts = imageUrl.split("/");
      const domainPart = urlParts[2]; // e.g., "bucket.region.digitaloceanspaces.com"

      if (!domainPart.match(/[^.]+\.[^.]+\.digitaloceanspaces\.com/)) {
        // If region is missing, add sfo3 region
        markdownToUse = markdown.replace(
          /image:\s*\n\s*src:\s*'([^']+)'/,
          (match: string, url: string) => {
            if (url.includes("digitaloceanspaces.com")) {
              const bucketName = url.split(".")[0].replace("https://", "");
              const updatedUrl = url.replace(
                `https://${bucketName}.digitaloceanspaces.com`,
                `https://${bucketName}.sfo3.digitaloceanspaces.com`
              );
              return `image:\n  src: '${updatedUrl}'`;
            }
            return match;
          }
        );
      }
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const token = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
      return NextResponse.json(
        { error: "Missing GitHub configuration" },
        { status: 500 }
      );
    }

    const fileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };

    // Check if file exists to get its SHA
    let sha = undefined;
    try {
      const getResp = await fetch(fileUrl, { headers });
      if (getResp.status === 200) {
        const data = await getResp.json();
        sha = data.sha;
      }
    } catch (error) {
      console.error("Error checking file existence:", error);
      // Continue without SHA if we can't get it
    }

    // Prepare payload
    const content_b64 = Buffer.from(markdownToUse).toString("base64");
    const payload: any = {
      message,
      content: content_b64,
      branch,
      committer: {
        name: "Automated Script",
        email: "actions@users.noreply.github.com",
      },
    };

    if (sha) payload.sha = sha;

    // Upsert (create or update)
    const putResp = await fetch(fileUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });

    if (!putResp.ok) {
      // Sanitize error message for security
      console.error(
        `GitHub API error: ${putResp.status}`,
        await putResp.text()
      );
      return NextResponse.json(
        { error: "Failed to save content. Please try again later." },
        { status: putResp.status }
      );
    }

    // Parse successful response
    try {
      const result = await putResp.json();
      return NextResponse.json({
        commitUrl: result.commit?.html_url || "File committed successfully",
        success: true,
      });
    } catch (jsonError) {
      // If parsing successful response fails, still return success
      console.error("Error parsing GitHub response:", jsonError);
      return NextResponse.json({
        commitUrl:
          "File committed successfully, but couldn't retrieve commit URL",
        success: true,
      });
    }
  } catch (error: any) {
    // Log the detailed error for debugging but return a sanitized error
    console.error("GitHub API error:", error);
    return NextResponse.json(
      {
        error:
          "An error occurred while saving the content. Please try again later.",
      },
      {
        status: 500,
      }
    );
  }
}

// Add DELETE method to handle post deletion
export async function DELETE(req: NextRequest) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get the file path from the request
    const { path } = await req.json();

    if (!path) {
      return NextResponse.json(
        { error: "Missing required field: path" },
        { status: 400 }
      );
    }

    // Enhance path security
    // Strip any leading or trailing slashes
    const cleanPath = path.replace(/^\/+|\/+$/g, "");

    // Ensure path is in the allowed format (for security)
    if (
      !cleanPath.startsWith("src/content/blog/") ||
      !cleanPath.endsWith(".md")
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid path format. Path must be a markdown file in src/content/blog/",
        },
        { status: 400 }
      );
    }

    // Check for path traversal attempts
    if (
      cleanPath.includes("../") ||
      cleanPath.includes("./") ||
      cleanPath.includes("..\\") ||
      cleanPath.includes(".\\")
    ) {
      console.error("Path traversal attempt detected:", path);
      return NextResponse.json(
        { error: "Invalid path format." },
        { status: 400 }
      );
    }

    // Validate filename format
    const filename = cleanPath.split("/").pop() || "";
    const filenamePattern = /^[a-zA-Z0-9_-]+\.md$/;
    if (!filenamePattern.test(filename)) {
      return NextResponse.json(
        { error: "Invalid filename format." },
        { status: 400 }
      );
    }

    // Get GitHub config from environment variables - using the same variables as POST
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const token = process.env.GITHUB_TOKEN;

    // Check if GitHub config is available
    if (!owner || !repo || !token) {
      return NextResponse.json(
        { error: "Missing GitHub configuration" },
        { status: 500 }
      );
    }

    // Set up GitHub API request using the same variables as POST route
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    // First, get the current file information to get the SHA
    const getResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!getResponse.ok) {
      const status = getResponse.status;
      let errorText = "";
      try {
        const errorData = await getResponse.json();
        errorText = errorData.message || getResponse.statusText;
      } catch (e) {
        errorText = getResponse.statusText;
      }

      console.error(`Error getting file info: ${status} - ${errorText}`);
      return NextResponse.json(
        { error: `GitHub API error: ${status} - ${errorText}` },
        { status }
      );
    }

    const fileInfo = await getResponse.json();

    // Create delete request
    const deleteResponse = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `chore: delete post '${path
          .split("/")
          .pop()
          ?.replace(".md", "")}'`,
        sha: fileInfo.sha,
        branch,
      }),
    });

    if (!deleteResponse.ok) {
      let errorMessage = "Failed to delete file";
      try {
        const errorData = await deleteResponse.json();
        errorMessage = `${errorMessage}: ${
          errorData.message || deleteResponse.statusText
        }`;
      } catch (e) {
        errorMessage = `${errorMessage}: ${deleteResponse.statusText}`;
      }

      console.error(`Delete error: ${deleteResponse.status} - ${errorMessage}`);
      return NextResponse.json(
        { error: errorMessage },
        { status: deleteResponse.status }
      );
    }

    const deleteData = await deleteResponse.json();

    return NextResponse.json({
      success: true,
      commitUrl: deleteData.commit.html_url,
      message: `Post '${path}' has been deleted successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
