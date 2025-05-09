import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

// Store request timestamps in a module-level variable instead
const requestTimes: Record<string, number> = {};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Read the request body once and store it
    const requestData = await req.json();
    const { content, title, author, category, tags, imageUrl, prompt, type, parsed, conversation } = requestData;

    // Validate inputs to prevent abuse
    if (prompt && prompt.length > 5000) {
      return NextResponse.json({ error: "Prompt exceeds maximum length" }, { status: 400 });
    }
    
    if (content && content.length > 50000) {
      return NextResponse.json({ error: "Content exceeds maximum length" }, { status: 400 });
    }
    
    // Validate OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is missing");
      return NextResponse.json({ error: "Service configuration error" }, { status: 500 });
    }
    
    // Apply rate limiting for OpenAI requests (in addition to global rate limiting)
    // This is a simple implementation and can be enhanced
    const email = session.user?.email || 'unknown';
    const requestTimeKey = `openai_req_${email}`;
    
    // Check if user has recently made an API request
    const lastRequestTime = requestTimes[requestTimeKey] || 0;
    const now = Date.now();
    const cooldownPeriod = 2000; // 2 seconds between requests
    
    if (now - lastRequestTime < cooldownPeriod) {
      return NextResponse.json(
        { error: "Please wait before making another request" },
        { status: 429 }
      );
    }
    
    // Update request time
    requestTimes[requestTimeKey] = now;

    // If we already have parsed content and just need the markdown, use it
    if (parsed) {
      const { titleEn, titleKo, excerptEn, excerptKo, contentEn, contentKo } = parsed;
      
      // Ensure the image URL is properly formatted
      let formattedImageUrl = imageUrl || "";
      if (formattedImageUrl && formattedImageUrl.includes('digitaloceanspaces.com')) {
        const urlParts = formattedImageUrl.split('/');
        const domainPart = urlParts[2]; // e.g., "bucket.region.digitaloceanspaces.com"
        
        // Check if the URL is missing region
        if (!domainPart.match(/[^.]+\.[^.]+\.digitaloceanspaces\.com/)) {
          // Extract bucket name
          const bucketName = domainPart.split('.')[0];
          // Default to sfo3 as the region
          formattedImageUrl = formattedImageUrl.replace(
            `https://${bucketName}.digitaloceanspaces.com`, 
            `https://${bucketName}.sfo3.digitaloceanspaces.com`
          );
        }
      }
      
      // Format the markdown according to the required template
      const formattedMarkdown = `---
title:
  en: '${titleEn.replace(/'/g, "''")}'
  ko: '${titleKo.replace(/'/g, "''")}'
date: '${new Date().toISOString().split('T')[0]}'
author: '${author || "Admin"}'
image:
  src: '${formattedImageUrl}'
  alt: '${titleEn.replace(/'/g, "''")}'
excerpt:
  en: '${excerptEn.replace(/'/g, "''")}'
  ko: '${excerptKo.replace(/'/g, "''")}'
category: '${category || "Education"}'
authorImage: 'https://bageledu.sfo3.cdn.digitaloceanspaces.com/hyejeong.jpg'
tags:
  [${(tags || "Education,Learning").split(",").map((tag: string) => `'${tag.trim().replace(/'/g, "''")}'`).join(", ")}]
---

<div class="en-content" x-show="$store.language !== 'ko'">
${contentEn ? `${contentEn.replace(/\{\s*'\s*\}\s*\n*/g, "\n")}` : ''}
</div>

<div class="ko-content" x-show="$store.language === 'ko'">
${contentKo ? `${contentKo.replace(/\{\s*'\s*\}\s*\n*/g, "\n")}` : ''}
</div>`;

      return NextResponse.json({ 
        markdown: formattedMarkdown,
        parsed: {
          titleEn,
          titleKo,
          excerptEn,
          excerptKo,
          contentEn,
          contentKo
        }
      });
    }

    // For chat-based prompts (AI assistance)
    if (prompt && type === "blog_ideas") {
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: `You are a bilingual content creation assistant specializing in educational content.
            Generate ideas or suggestions based on the user's prompt.`
          },
          { 
            role: "user", 
            content: `I need ideas or suggestions for my blog post.
            
            User prompt: "${prompt}"
            ${content ? `Current content: "${content}"` : ''}
            ${title ? `Current title: "${title}"` : ''}
            
            Please generate creative, thoughtful suggestions in both English and Korean.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const generatedContent = aiResponse.choices[0].message.content || "";
      
      // Parse the AI response - using regular expressions without /s flag for compatibility
      const titleEnMatch = generatedContent.match(/TITLE_EN:([\s\S]+?)(?=TITLE_KO:|$)/);
      const titleKoMatch = generatedContent.match(/TITLE_KO:([\s\S]+?)(?=EXCERPT_EN:|$)/);
      const excerptEnMatch = generatedContent.match(/EXCERPT_EN:([\s\S]+?)(?=EXCERPT_KO:|$)/);
      const excerptKoMatch = generatedContent.match(/EXCERPT_KO:([\s\S]+?)(?=CONTENT_EN:|$)/);
      const contentEnMatch = generatedContent.match(/CONTENT_EN:([\s\S]+?)(?=CONTENT_KO:|$)/);
      const contentKoMatch = generatedContent.match(/CONTENT_KO:([\s\S]+?)(?=$)/);

      // Extract and clean the content
      const titleEn = titleEnMatch ? titleEnMatch[1].trim() : title || "";
      const titleKo = titleKoMatch ? titleKoMatch[1].trim() : "";
      const excerptEn = excerptEnMatch ? excerptEnMatch[1].trim() : "";
      const excerptKo = excerptKoMatch ? excerptKoMatch[1].trim() : "";
      
      // Clean up the content to remove spacers and unnecessary comments
      let contentEn = contentEnMatch ? contentEnMatch[1].trim() : content || "";
      let contentKo = contentKoMatch ? contentKoMatch[1].trim() : "";
      
      // Remove {' '} spacers and HTML comments
      contentEn = contentEn.replace(/\{\s*'\s*\}\s*\n*/g, "\n").replace(/\{\/\*\s*.*?\*\/\}/g, "");
      contentKo = contentKo.replace(/\{\s*'\s*\}\s*\n*/g, "\n").replace(/\{\/\*\s*.*?\*\/\}/g, "");

      return NextResponse.json({
        parsed: {
          titleEn,
          titleKo,
          excerptEn,
          excerptKo,
          contentEn,
          contentKo
        }
      });
    }
    
    // For interactive AI chat assistant
    if (prompt && type === "chat_assistant") {
      // Use conversation history from the already parsed request data
      const conversationHistory = conversation || [];
      
      // Prepare messages array with conversation history
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        {
          role: "system",
          content: `You are an expert bilingual (English/Korean) assistant for content creators.
          
          You help educators and content creators working on blog posts about education-related topics.
          
          Your capabilities include:
          1. Brainstorming blog post ideas
          2. Suggesting improvements to existing content
          3. Helping with content structure
          4. Answering questions about education content
          5. Providing examples and explanations
          
          Keep your responses helpful, conversational, and to the point.
          
          The user is working on a bilingual blog post editor.
          
          When providing examples or suggestions, it's often helpful to show both English and Korean versions.
          
          Your advice should be practical and implementable - focus on concrete suggestions.
          
          IMPORTANT: Keep your responses concise and well-formatted for easy reading.`
        }
      ];
      
      // Add conversation history, but limit it to last 5 messages to reduce token usage
      if (conversationHistory && conversationHistory.length > 0) {
        conversationHistory.slice(-5).forEach((msg: { role: 'system' | 'user' | 'assistant'; content: string }) => {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        });
      }
      
      // Add the current user message
      messages.push({
        role: "user",
        content: prompt
      });
      
      // Call OpenAI with the conversation
      const chatResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        temperature: 0.7,
        max_tokens: 800,
      });
      
      // Get and return the assistant's response
      const assistantResponse = chatResponse.choices[0].message.content || "";
      
      return NextResponse.json({
        response: assistantResponse,
        role: "assistant"
      });
    }

    // For generating preview or full post from single language input
    if (!content || !title) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Detect language first
    const detectResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a language detection assistant. Identify the primary language of the text as either 'English' or 'Korean'. Respond with ONLY 'English' or 'Korean'."
        },
        { role: "user", content: content }
      ],
      temperature: 0,
      max_tokens: 10,
    });

    const detectedLanguage = detectResponse.choices[0].message.content?.trim() || "English";
    const isKorean = detectedLanguage === "Korean";

    // Create a comprehensive prompt for the AI to generate content in both languages
    const promptMessage = `
    I need a bilingual blog post based on this ${isKorean ? "Korean" : "English"} content. Please enhance and translate it to create content in BOTH languages.
    
    Original ${isKorean ? "Korean" : "English"} title: "${title}"
    Original ${isKorean ? "Korean" : "English"} content: "${content}"
    
    Please generate:
    1. An engaging ${isKorean ? "English" : "Korean"} title that matches the theme
    2. The original ${isKorean ? "Korean" : "English"} title, preserved
    3. A concise excerpt in both languages (1-2 sentences each)
    4. Full, well-structured content in both languages
    
    Category: ${category || "Education"}
    Tags: ${tags || "Education, Learning"}
    Author: ${author || "Admin"}
    
    IMPORTANT RULES FOR KOREAN CONTENT:
    1. Make sure the Korean title and excerpt are properly translated, not placeholders
    2. The Korean title should convey the same meaning as the English title
    3. The Korean excerpt should be a true translation of the English excerpt
    4. All Korean content must be natural, fluent Korean, not machine-translated text
    5. Korean content should be culturally appropriate and use natural phrasing
    6. Do NOT use placeholder text like "한국어 발췌문" or "Korean Title"
    
    Content Structure:
    - The content should follow standard blog format with introduction, body sections, and conclusion
    - Use proper HTML tags (p, h2, ul/li, etc.) for formatting
    - Each section in English should have a corresponding section in Korean
    
    Example format:
    ---
    title:
      en: 'English Title'
      ko: '한국어 제목 - properly translated'
    ...
    ---
    
    <div class="en-content" x-show="$store.language !== 'ko'">
    
    <p>
      First paragraph content in English.
    </p>
    
    <hr />
    
    <h2>First Section</h2>
    <p>
      Section content in English.
    </p>
    ...
    </div>
    
    <div class="ko-content" x-show="$store.language === 'ko'">
    
    <p>
      한국어로 된 첫 번째 단락 내용.
    </p>
    
    <hr />
    
    <h2>첫 번째 섹션</h2>
    <p>
      한국어로 된 섹션 내용.
    </p>
    ...
    </div>
    `;

    // Make API call to OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using a more capable model for high-quality translation
      messages: [
        { 
          role: "system", 
          content: `You are a bilingual content creation assistant specializing in educational content. 
          Generate content for a blog post in both English and Korean, following exactly the format requested.
          Structure your response as a complete markdown document with proper YAML frontmatter and content sections.
          
          IMPORTANT FORMATTING RULES:
          1. Include HTML comments like {/* English Content */} and {/* Korean Content */}
          2. Make sure both language sections are properly formatted with matching structure
          3. Both English and Korean content sections must have the same structure (paragraphs, headings, etc.)
          4. Each content section must be wrapped in a div with proper class and x-show attribute
          
          Follow EXACTLY this example structure:
          
          ---
          title:
            en: 'English Title'
            ko: 'Korean Title'
          date: '2025-01-01'
          author: 'Author Name'
          image:
            src: 'image-url'
            alt: 'Image Alt Text'
          excerpt:
            en: 'English excerpt'
            ko: 'Korean excerpt'
          category: 'Category'
          authorImage: 'https://bageledu.sfo3.cdn.digitaloceanspaces.com/hyejeong.jpg'
          tags:
            ['Tag1', 'Tag2', 'Tag3']
          ---
          
          {/* English Content */}
          
          <div class="en-content" x-show="$store.language !== 'ko'">
          

          
          <p>
            First paragraph content in English.
          </p>
          

          
          <hr />
          

          
          <h2>First Section</h2>
          <p>
            Section content in English.
          </p>
          

          
          <h2>Another Section</h2>
          <p>
            More content in English.
          </p>
          </div>
          
          {/* Korean Content */}
          
          <div class="ko-content" x-show="$store.language === 'ko'">
          
 
          <p>
            First paragraph content in Korean.
          </p>
          
     
          
          <hr />
          
  
          
          <h2>First Section in Korean</h2>
          <p>
            Section content in Korean.
          </p>
          
      
          
          <h2>Another Section in Korean</h2>
          <p>
            More content in Korean.
          </p>
          </div>`
        },
        { role: "user", content: promptMessage }
      ],
      temperature: 0.7,
      max_tokens: 3000, // Higher token limit for bilingual content
    });

    // Get the generated content
    const generatedContent = response.choices[0].message.content || "";
    
    console.log("Raw AI response:", generatedContent.substring(0, 200) + "..."); // Log the beginning for debugging
    
    // Try different approaches to extract the content
    let frontMatter = "";
    let contentSection = "";
    let titleEn = isKorean ? "" : title;
    let titleKo = isKorean ? title : "";
    let excerptEn = "";
    let excerptKo = "";
    let contentEn = isKorean ? "" : content;
    let contentKo = isKorean ? content : "";
    
    // First try to extract as a properly formatted markdown document
    const frontMatterMatch = generatedContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (frontMatterMatch) {
      // Successfully extracted front matter and content
      frontMatter = frontMatterMatch[1];
      contentSection = frontMatterMatch[2];
      
      // Extract the different parts from front matter
      const titleEnMatch = frontMatter.match(/title:\s*\n\s*en:\s*['"]([^'"]*)['"]/);
      const titleKoMatch = frontMatter.match(/title:\s*\n\s*ko:\s*['"]([^'"]*)['"]/);
      const excerptEnMatch = frontMatter.match(/excerpt:\s*\n\s*en:\s*['"]([^'"]*)['"]/);
      const excerptKoMatch = frontMatter.match(/excerpt:\s*\n\s*ko:\s*['"]([^'"]*)['"]/);
      
      // Extract English and Korean content sections
      const enContentMatch = contentSection.match(/<div class="en-content"[^>]*>([\s\S]*?)<\/div>/);
      const koContentMatch = contentSection.match(/<div class="ko-content"[^>]*>([\s\S]*?)<\/div>/);
      
      // Extract and clean content
      if (titleEnMatch?.[1]) titleEn = titleEnMatch[1];
      if (titleKoMatch?.[1]) titleKo = titleKoMatch[1];
      if (excerptEnMatch?.[1]) excerptEn = excerptEnMatch[1];
      if (excerptKoMatch?.[1]) excerptKo = excerptKoMatch[1];
      if (enContentMatch?.[1]) contentEn = enContentMatch[1];
      if (koContentMatch?.[1]) contentKo = koContentMatch[1];
    } else {
      // Fallback to more flexible extraction if markdown format fails
      console.log("Markdown extraction failed, trying fallback pattern matching...");
      
      // Try to extract titles directly
      const titleEnAltMatch = generatedContent.match(/title:\s*\n\s*en:\s*['"]([^'"]*)['"]/);
      const titleKoAltMatch = generatedContent.match(/title:\s*\n\s*ko:\s*['"]([^'"]*)['"]/);
      
      // Try alternative title patterns
      if (!titleEnAltMatch) {
        const altTitleEnMatch = generatedContent.match(/TITLE_EN:?\s*(.*?)(?=TITLE_KO|EXCERPT|$)/i);
        if (altTitleEnMatch?.[1]) titleEn = altTitleEnMatch[1].trim();
      } else if (titleEnAltMatch?.[1]) {
        titleEn = titleEnAltMatch[1];
      }
      
      if (!titleKoAltMatch) {
        const altTitleKoMatch = generatedContent.match(/TITLE_KO:?\s*(.*?)(?=EXCERPT|CONTENT|$)/i);
        if (altTitleKoMatch?.[1]) titleKo = altTitleKoMatch[1].trim();
      } else if (titleKoAltMatch?.[1]) {
        titleKo = titleKoAltMatch[1];
      }
      
      // Try to extract excerpts
      const excerptEnAltMatch = generatedContent.match(/EXCERPT_EN:?\s*(.*?)(?=EXCERPT_KO|CONTENT|$)/i);
      const excerptKoAltMatch = generatedContent.match(/EXCERPT_KO:?\s*(.*?)(?=CONTENT|$)/i);
      
      if (excerptEnAltMatch?.[1]) excerptEn = excerptEnAltMatch[1].trim();
      if (excerptKoAltMatch?.[1]) excerptKo = excerptKoAltMatch[1].trim();
      
      // Try to extract content
      const contentEnAltMatch = generatedContent.match(/CONTENT_EN:?\s*([\s\S]*?)(?=CONTENT_KO|$)/);
      const contentKoAltMatch = generatedContent.match(/CONTENT_KO:?\s*([\s\S]*?)$/);
      
      if (contentEnAltMatch?.[1]) contentEn = contentEnAltMatch[1].trim();
      if (contentKoAltMatch?.[1]) contentKo = contentKoAltMatch[1].trim();
      
      // Alternate div extraction if that fails
      if (!contentEn.includes('<p>')) {
        const enDivMatch = generatedContent.match(/<div class="en-content"[^>]*>([\s\S]*?)<\/div>/);
        if (enDivMatch?.[1]) contentEn = enDivMatch[1];
      }
      
      if (!contentKo.includes('<p>')) {
        const koDivMatch = generatedContent.match(/<div class="ko-content"[^>]*>([\s\S]*?)<\/div>/);
        if (koDivMatch?.[1]) contentKo = koDivMatch[1];
      }
      
      console.log("Fallback extraction results:", {
        titleFound: !!titleEn && !!titleKo,
        excerptFound: !!excerptEn && !!excerptKo,
        contentFound: contentEn.includes('<p>') && contentKo.includes('<p>')
      });
    }
    
    // Ensure we have minimum required content
    if (!titleEn) titleEn = isKorean ? "English Title" : title;
    if (!titleKo) {
      // If we have an English title but no Korean title, get a proper translation
      if (titleEn && titleEn !== "English Title") {
        try {
          // Generate a proper Korean title using a separate API call
          const koreanTitleResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a Korean translator. Translate the given English title to natural, fluent Korean. Respond ONLY with the Korean translation, nothing else."
              },
              {
                role: "user",
                content: `Translate this title to Korean: "${titleEn}"`
              }
            ],
            temperature: 0.3,
            max_tokens: 100
          });
          
          const generatedKoreanTitle = koreanTitleResponse.choices[0].message.content?.trim();
          if (generatedKoreanTitle && generatedKoreanTitle !== "Korean Title") {
            titleKo = generatedKoreanTitle;
          } else {
            titleKo = "대학 지원 과정 안내"; // Default if translation fails
          }
        } catch (e) {
          console.error("Error generating Korean title:", e);
          titleKo = "대학 지원 과정 안내"; // Default if API call fails
        }
      } else {
        titleKo = "대학 지원 과정 안내"; // Default Korean title
      }
    }

    if (!excerptEn) excerptEn = "English excerpt for the blog post.";
    if (!excerptKo || excerptKo === "한국어 발췌문.") {
      // If we have an English excerpt but no Korean excerpt, get a proper translation
      if (excerptEn && excerptEn !== "English excerpt for the blog post.") {
        try {
          // Generate a proper Korean excerpt using a separate API call
          const koreanExcerptResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a Korean translator. Translate the given English excerpt to natural, fluent Korean. Respond ONLY with the Korean translation, nothing else."
              },
              {
                role: "user",
                content: `Translate this excerpt to Korean: "${excerptEn}"`
              }
            ],
            temperature: 0.3,
            max_tokens: 200
          });
          
          const generatedKoreanExcerpt = koreanExcerptResponse.choices[0].message.content?.trim();
          if (generatedKoreanExcerpt && generatedKoreanExcerpt !== "한국어 발췌문.") {
            excerptKo = generatedKoreanExcerpt;
          } else {
            excerptKo = "대학 지원 과정에 대한 흥미롭고 유익한 안내입니다."; // Default if translation fails
          }
        } catch (e) {
          console.error("Error generating Korean excerpt:", e);
          excerptKo = "대학 지원 과정에 대한 흥미롭고 유익한 안내입니다."; // Default if API call fails
        }
      } else {
        excerptKo = "대학 지원 과정에 대한 흥미롭고 유익한 안내입니다."; // Default Korean excerpt
      }
    }
    
    // Ensure the content has proper structure if it was extracted in an unexpected format
    if (!contentEn.includes('<p>')) {
      contentEn = `
    <p>
      ${contentEn || (isKorean ? "English content placeholder." : content)}
    </p>



    <hr />



    <h2>Section Title</h2>
    <p>
      Additional content will go here.
    </p>`;
    }
    
    if (!contentKo.includes('<p>')) {
      contentKo = `
    <p>
      ${contentKo || (isKorean ? content : "한국어 콘텐츠.")}
    </p>



    <hr />



    <h2>섹션 제목</h2>
    <p>
      추가 콘텐츠가 여기에 들어갑니다.
    </p>`;
    }
    
    // Clean up possible issues
    // Ensure proper spacer format
    contentEn = contentEn.replace(/\{\s+'(\s+)?\}/g, "{' '}");
    contentKo = contentKo.replace(/\{\s+'(\s+)?\}/g, "{' '}");
    
    // Ensure the image URL is properly formatted
    let formattedImageUrl = imageUrl || "";
    if (formattedImageUrl && formattedImageUrl.includes('digitaloceanspaces.com')) {
      const urlParts = formattedImageUrl.split('/');
      const domainPart = urlParts[2]; // e.g., "bucket.region.digitaloceanspaces.com"
      
      // Check if the URL is missing region
      if (!domainPart.match(/[^.]+\.[^.]+\.digitaloceanspaces\.com/)) {
        // Extract bucket name
        const bucketName = domainPart.split('.')[0];
        // Default to sfo3 as the region
        formattedImageUrl = formattedImageUrl.replace(
          `https://${bucketName}.digitaloceanspaces.com`, 
          `https://${bucketName}.sfo3.digitaloceanspaces.com`
        );
      }
    }

    // Format the markdown according to the required template with proper spacers
    const formattedMarkdown = `---
title:
  en: '${titleEn.replace(/'/g, "''")}'
  ko: '${titleKo.replace(/'/g, "''")}'
date: '${new Date().toISOString().split('T')[0]}'
author: '${author || "Admin"}'
image:
  src: '${formattedImageUrl}'
  alt: '${titleEn.replace(/'/g, "''")}'
excerpt:
  en: '${excerptEn.replace(/'/g, "''")}'
  ko: '${excerptKo.replace(/'/g, "''")}'
category: '${category || "Education"}'
authorImage: 'https://bageledu.sfo3.cdn.digitaloceanspaces.com/hyejeong.jpg'
tags:
  [${(tags || "Education,Learning").split(",").map((tag: string) => `'${tag.trim().replace(/'/g, "''")}'`).join(", ")}]
---

{/* English Content */}

<div class="en-content" x-show="$store.language !== 'ko'">
  <h1>${titleEn}</h1>

<p>
  ${contentEn.trim().replace(/<p>/g, '').replace(/<\/p>/g, '').trim()}
</p>

<hr />

</div>

{/* Korean Content */}

<div class="ko-content" x-show="$store.language === 'ko'">
  <h1>${titleKo}</h1>

<p>
  ${contentKo.trim().replace(/<p>/g, '').replace(/<\/p>/g, '').trim() || '대학 지원 과정은 학생의 미래를 결정하는 중요한 단계입니다. 이 과정을 통해 학생들은 자신의 관심사와 목표에 맞는 대학을 찾을 수 있습니다.'}
</p>

<hr />

</div>`;

    // Return the generated markdown
    return NextResponse.json({ 
      markdown: formattedMarkdown,
      parsed: {
        titleEn,
        titleKo,
        excerptEn,
        excerptKo,
        contentEn,
        contentKo
      }
    });
  } catch (error: any) {
    console.error("OpenAI API error:", error);
    
    // Handle rate limits specifically
    if (error.status === 429) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Error generating content" },
      { status: 500 }
    );
  }
} 