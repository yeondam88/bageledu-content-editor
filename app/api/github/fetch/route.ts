import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const token = process.env.GITHUB_TOKEN;
    const path = "src/content/blog";

    if (!owner || !repo || !token) {
      return NextResponse.json({ error: "Missing GitHub configuration" }, { status: 500 });
    }

    const contentUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const headers = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    // Fetch the list of files in the blog directory
    const dirResp = await fetch(contentUrl, { headers });
    
    if (!dirResp.ok) {
      let errorMessage = "Failed to fetch blog posts";
      try {
        const errorData = await dirResp.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        errorMessage = `GitHub API error: ${dirResp.status}`;
      }
      return NextResponse.json({ error: errorMessage }, { status: dirResp.status });
    }

    const files = await dirResp.json();
    
    // Get only markdown files
    const markdownFiles = files.filter((file: any) => file.name.endsWith('.md'));
    
    // For each file, fetch its content
    const posts = await Promise.all(
      markdownFiles.map(async (file: any) => {
        try {
          const fileResp = await fetch(file.url, { headers });
          
          if (!fileResp.ok) {
            console.error(`Failed to fetch content for ${file.name}: ${fileResp.status}`);
            return null;
          }
          
          const fileData = await fileResp.json();
          const content = Buffer.from(fileData.content, 'base64').toString('utf-8');

          console.log(`content: ${content}`);
          
          // Extract front matter
          const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
          const frontMatter = frontMatterMatch ? frontMatterMatch[1] : '';
          
          // Extract title and other metadata with improved patterns
          // These patterns handle apostrophes and other special characters in titles
          const titleEnMatch = frontMatter.match(/title:[^]*?en:[^]*?['"]([^'"]*(?:['"][^'"]*)*?)['"](?:\s|$)/);
          const titleKoMatch = frontMatter.match(/title:[^]*?ko:[^]*?['"]([^'"]*(?:['"][^'"]*)*?)['"](?:\s|$)/);
          
          // Extract and clean up the values
          let titleEn = titleEnMatch ? titleEnMatch[1].replace(/''/g, "'") : '';
          let titleKo = titleKoMatch ? titleKoMatch[1].replace(/''/g, "'") : '';
          
          // Also try to extract excerpts with improved patterns
          const excerptEnMatch = frontMatter.match(/excerpt:[^]*?en:[^]*?['"]([^'"]*(?:['"][^'"]*)*?)['"](?:\s|$)/);
          const excerptKoMatch = frontMatter.match(/excerpt:[^]*?ko:[^]*?['"]([^'"]*(?:['"][^'"]*)*?)['"](?:\s|$)/);
          
          let excerptEn = excerptEnMatch ? excerptEnMatch[1].replace(/''/g, "'") : '';
          let excerptKo = excerptKoMatch ? excerptKoMatch[1].replace(/''/g, "'") : '';
          
          // IMPROVED: Try alternative regex patterns if the first ones fail
          if (!titleKo) {
            const altTitleKoMatch = frontMatter.match(/title:[\s\S]*?ko:[\s\S]*?['"]([^'"]*(?:['"][^'"]*)*?)['"](?:\s|$)/);
            if (altTitleKoMatch) {
              titleKo = altTitleKoMatch[1].replace(/''/g, "'");
              console.log("Found Korean title with alternative pattern:", titleKo);
            }
          }
          
          if (!excerptKo) {
            const altExcerptKoMatch = frontMatter.match(/excerpt:[\s\S]*?ko:[\s\S]*?['"]([^'"]*(?:['"][^'"]*)*?)['"](?:\s|$)/);
            if (altExcerptKoMatch) {
              excerptKo = altExcerptKoMatch[1].replace(/''/g, "'");
              console.log("Found Korean excerpt with alternative pattern:", excerptKo);
            }
          }
          
          // If we still don't have the Korean title or excerpt, try to extract from the content
          if (!titleKo || !excerptKo) {
            // Extract from ko-content div
            const koContentMatch = content.match(/<div class="ko-content"[^>]*>(?:\s*<h1>(.*?)<\/h1>)?\s*([\s\S]*?)<\/div>/);
            
            if (koContentMatch) {
              // If title is missing but we have an h1 tag in the Korean content
              if (!titleKo && koContentMatch[1]) {
                titleKo = koContentMatch[1].trim();
                console.log("Extracted Korean title from content h1:", titleKo);
              }
              
              // If excerpt is missing, use the first paragraph from the Korean content
              if (!excerptKo) {
                const firstParagraphMatch = koContentMatch[2].match(/<p>(.*?)<\/p>/);
                if (firstParagraphMatch) {
                  // Take first 100 characters as excerpt
                  excerptKo = firstParagraphMatch[1].substring(0, 100).trim();
                  if (firstParagraphMatch[1].length > 100) excerptKo += '...';
                  console.log("Extracted Korean excerpt from content p:", excerptKo);
                }
              }
            }
          }
          
          // More aggressive content extraction if still missing
          if (!titleKo || !excerptKo) {
            // Try to find Korean content by looking for Korean characters in the raw content
            const koreanTextMatches = content.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]+[^<>\n]*[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/g);
            
            if (koreanTextMatches && koreanTextMatches.length > 0) {
              console.log("Found Korean text in raw content, attempting to extract missing fields");
              
              // If title is missing, use the first substantial Korean text (more than 10 chars)
              if (!titleKo) {
                const potentialTitle = koreanTextMatches.find(text => text.length > 10);
                if (potentialTitle) {
                  titleKo = potentialTitle.trim();
                  console.log("Extracted Korean title from raw content:", titleKo);
                }
              }
              
              // If excerpt is missing, use another Korean text block
              if (!excerptKo && koreanTextMatches.length > 1) {
                // Try to find a longer text for excerpt, different from title
                const potentialExcerpt = koreanTextMatches
                  .filter(text => text !== titleKo && text.length > 15)
                  .sort((a, b) => b.length - a.length)[0]; // Use the longest match
                
                if (potentialExcerpt) {
                  excerptKo = potentialExcerpt.trim();
                  if (excerptKo.length > 100) excerptKo = excerptKo.substring(0, 100) + '...';
                  console.log("Extracted Korean excerpt from raw content:", excerptKo);
                }
              }
            }
          }
          
          // Last resort fallback - if we still don't have Korean content, create placeholders that indicate missing data
          if (!titleKo && titleEn) {
            titleKo = `[번역 필요] ${titleEn}`;
            console.log("Using English title as fallback for Korean title:", titleKo);
          }
          
          if (!excerptKo && excerptEn) {
            excerptKo = `[번역 필요] ${excerptEn}`;
            console.log("Using English excerpt as fallback for Korean excerpt:", excerptKo);
          }
          
          // Debug the extraction with more details
          console.log(`Full extraction for ${file.name}:`, { 
            rawTitleEn: titleEnMatch ? titleEnMatch[1] : 'no match',
            rawTitleKo: titleKoMatch ? titleKoMatch[1] : 'no match',
            cleanedTitleEn: titleEn,
            cleanedTitleKo: titleKo,
            excerptEn,
            excerptKo,
            hasKoreanTitle: !!titleKo,
            hasKoreanExcerpt: !!excerptKo
          });
          
          // Extract other metadata with improved patterns
          const dateMatch = frontMatter.match(/date:\s*['"](.*?)['"](?:\s|$)/);
          const imageMatch = frontMatter.match(/image:\s*\n\s*src:\s*['"](.*?)['"](?:\s|$)/);
          const categoryMatch = frontMatter.match(/category:\s*['"](.*?)['"](?:\s|$)/);
          
          // Improved tag extraction pattern to handle array format
          const tagsMatch = frontMatter.match(/tags:\s*\n?\s*\[([\s\S]*?)\]/);
          const authorMatch = frontMatter.match(/author:\s*['"](.*?)['"](?:\s|$)/);
          
          // Parse and clean up values
          const date = dateMatch ? dateMatch[1] : '';
          const image = imageMatch ? imageMatch[1] : '';
          const category = categoryMatch ? categoryMatch[1] : '';
          
          // Properly process tags from array format
          let tags = "";
          if (tagsMatch && tagsMatch[1]) {
            // Clean up the tags array format
            tags = tagsMatch[1].trim()
              .replace(/'/g, "") // Remove quotes
              .replace(/"/g, "")
              .replace(/\s*,\s*/g, ","); // Clean up whitespace around commas
          }
          
          const author = authorMatch ? authorMatch[1] : 'Admin';
          
          // Debug tag extraction specifically
          console.log(`Tag extraction for ${file.name}:`, {
            rawTags: tagsMatch ? tagsMatch[1] : 'no match',
            processedTags: tags
          });
          
          // Extract content sections with improved patterns
          // These patterns better handle real-world HTML content
          const enContentMatch = content.match(/<div class="en-content"[^>]*>\s*(?:<h1>.*?<\/h1>)?\s*([\s\S]*?)<\/div>/);
          const koContentMatch = content.match(/<div class="ko-content"[^>]*>\s*(?:<h1>.*?<\/h1>)?\s*([\s\S]*?)<\/div>/);
          
          // Clean up extracted content
          let contentEn = enContentMatch ? enContentMatch[1].trim() : '';
          let contentKo = koContentMatch ? koContentMatch[1].trim() : '';
          
          // Debug content extraction
          console.log(`Content extraction for ${file.name}:`, {
            enContentFound: !!enContentMatch,
            koContentFound: !!koContentMatch,
            enContentLength: contentEn.length,
            koContentLength: contentKo.length
          });
          
          return {
            name: file.name,
            path: file.path,
            sha: fileData.sha,
            titleEn: titleEn,
            titleKo: titleKo,
            date: date,
            image: image,
            category: category,
            tags: tags,
            author: author,
            excerptEn: excerptEn,
            excerptKo: excerptKo,
            contentEn: contentEn,
            contentKo: contentKo,
            rawContent: content
          };
        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);
          return null;
        }
      })
    );
    
    // Filter out any null entries from errors
    const validPosts = posts.filter(post => post !== null);
    
    return NextResponse.json({ posts: validPosts });
  } catch (error: any) {
    console.error("GitHub API fetch error:", error);
    return NextResponse.json({ 
      error: error.message || "An unexpected error occurred" 
    }, { 
      status: 500 
    });
  }
} 