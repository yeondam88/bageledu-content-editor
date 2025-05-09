"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession, signIn } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AIChatAssistant from "@/app/components/AIChatAssistant";

// Simple toast alternative
const showAlert = (message: string) => {
  alert(message);
};

// Main component
export default function BlogPage() {
  const { data: session, status } = useSession();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset
  } = useForm();
  
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{
    titleEn: string;
    titleKo: string;
    excerptEn: string;
    excerptKo: string;
    contentEn: string;
    contentKo: string;
  } | null>(null);
  
  // Ensure all preview fields exist
  const ensureCompletePreview = (data: any) => {
    // Create a complete preview object with fallbacks for missing fields
    const completePreview = {
      titleEn: data?.titleEn || "",
      titleKo: data?.titleKo || "",
      excerptEn: data?.excerptEn || "",
      excerptKo: data?.excerptKo || "",
      contentEn: data?.contentEn || "",
      contentKo: data?.contentKo || ""
    };
    
    // Log what we're returning
    console.log("Ensuring complete preview:", {
      originalTitleKo: data?.titleKo || "missing",
      newTitleKo: completePreview.titleKo,
      originalExcerptKo: data?.excerptKo || "missing",
      newExcerptKo: completePreview.excerptKo
    });
    
    return completePreview;
  };
  
  const [rawMarkdown, setRawMarkdown] = useState<string>("");
  const [editMode, setEditMode] = useState(false);
  const [existingPosts, setExistingPosts] = useState<any[]>([]);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [bypassOpenAI, setBypassOpenAI] = useState(false);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const formValues = watch();

  function slugify(text: string) {
    return text
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, "-");
  }

  // Fetch existing posts
  const fetchExistingPosts = async () => {
    setPostsLoading(true);
    try {
      const response = await fetch("/api/github/fetch");
      if (!response.ok) {
        throw new Error("Failed to fetch posts");
      }
      
      const data = await response.json();
      setExistingPosts(data.posts || []);
    } catch (error: any) {
      console.error("Error fetching posts:", error);
      showAlert("Failed to load existing posts: " + (error.message || "Unknown error"));
    } finally {
      setPostsLoading(false);
    }
  };

  // Load selected post data
  const loadPostData = (post: any) => {
    if (!post) return;
    
    console.log("Blog: Loading post data:", post);
    
    setSelectedPost(post);
    setEditMode(true);
    
    // Set form values - making sure to handle special characters
    setValue("title", post.titleEn || "");
    setValue("content", post.contentEn || ""); // We'll use English content for editing
    setValue("category", post.category || "");
    setValue("tags", post.tags ? post.tags.replace(/'/g, "").replace(/\[|\]/g, "") : "");
    setValue("author", post.author || "Admin");
    
    // Set image URL if available
    if (post.image) {
      setImageUrl(post.image);
    }
    
    // Handle missing Korean title by extracting from raw content if needed
    let titleKo = post.titleKo || "";
    let excerptEn = post.excerptEn || "";
    let excerptKo = post.excerptKo || "";
    
    // If we have raw content and fields are missing, try to extract them directly
    if (post.rawContent) {
      if (!titleKo) {
        const titleKoMatch = post.rawContent.match(/title:\s*\n\s*ko:\s*['"]([^]*?)['"](?:\s|$)/);
        if (titleKoMatch) {
          titleKo = titleKoMatch[1].replace(/''/g, "'");
          console.log("Blog: Extracted missing Korean title directly:", titleKo);
        }
        
        // Try to extract from content if still missing
        if (!titleKo) {
          const koContentMatch = post.rawContent.match(/<div class="ko-content"[^>]*>(?:\s*<h1>(.*?)<\/h1>)?\s*([\s\S]*?)<\/div>/);
          if (koContentMatch && koContentMatch[1]) {
            titleKo = koContentMatch[1].trim();
            console.log("Blog: Extracted Korean title from content h1:", titleKo);
          }
          
          // If still not found, try looking for Korean characters
          if (!titleKo) {
            const koreanTextMatches = post.rawContent.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]+[^<>\n]*[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/g);
            if (koreanTextMatches && koreanTextMatches.length > 0) {
              const potentialTitle = koreanTextMatches.find((text: string) => text.length > 10);
              if (potentialTitle) {
                titleKo = potentialTitle.trim();
                console.log("Blog: Extracted Korean title from raw Korean text:", titleKo);
              }
            }
          }
        }
      }
      
      if (!excerptEn) {
        const excerptEnMatch = post.rawContent.match(/excerpt:\s*\n\s*en:\s*['"]([^]*?)['"](?:\s|$)/);
        if (excerptEnMatch) {
          excerptEn = excerptEnMatch[1].replace(/''/g, "'");
          console.log("Blog: Extracted missing English excerpt directly");
        }
      }
      
      if (!excerptKo) {
        const excerptKoMatch = post.rawContent.match(/excerpt:\s*\n\s*ko:\s*['"]([^]*?)['"](?:\s|$)/);
        if (excerptKoMatch) {
          excerptKo = excerptKoMatch[1].replace(/''/g, "'");
          console.log("Blog: Extracted missing Korean excerpt directly");
        }
        
        // Try to extract from content if still missing
        if (!excerptKo) {
          const koContentMatch = post.rawContent.match(/<div class="ko-content"[^>]*>(?:\s*<h1>.*?<\/h1>)?\s*([\s\S]*?)<\/div>/);
          if (koContentMatch) {
            const firstParagraphMatch = koContentMatch[1].match(/<p>(.*?)<\/p>/);
            if (firstParagraphMatch) {
              // Take first 100 characters as excerpt
              excerptKo = firstParagraphMatch[1].substring(0, 100).trim();
              if (firstParagraphMatch[1].length > 100) excerptKo += '...';
              console.log("Blog: Extracted Korean excerpt from content p:", excerptKo);
            }
          }
          
          // If still not found, try looking for Korean characters
          if (!excerptKo) {
            const koreanTextMatches = post.rawContent.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]+[^<>\n]*[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/g);
            if (koreanTextMatches && koreanTextMatches.length > 1) {
              // Try to find a longer text for excerpt, different from title
              const potentialExcerpt = koreanTextMatches
                .filter((text: string) => text !== titleKo && text.length > 15)
                .sort((a: string, b: string) => b.length - a.length)[0]; // Use the longest match
              
              if (potentialExcerpt) {
                excerptKo = potentialExcerpt.trim();
                if (excerptKo.length > 100) excerptKo = excerptKo.substring(0, 100) + '...';
                console.log("Blog: Extracted Korean excerpt from raw Korean text:", excerptKo);
              }
            }
          }
        }
      }
    }
    
    // Set preview data with all available data
    setPreview(ensureCompletePreview({
      titleEn: post.titleEn || "",
      titleKo: titleKo,
      excerptEn: excerptEn,
      excerptKo: excerptKo,
      contentEn: post.contentEn || "",
      contentKo: post.contentKo || ""
    }));
    
    // Set raw markdown
    setRawMarkdown(post.rawContent || "");
    
    // Debug what was loaded
    console.log("Blog: Set post data:", {
      title: post.titleEn,
      titleKo: titleKo,
      excerptEn: excerptEn,
      excerptKo: excerptKo,
      content: post.contentEn?.substring(0, 100) + "...", // Just show beginning for debug
      contentKo: post.contentKo?.substring(0, 100) + "..."
    });
    
    showAlert("Post loaded for editing. Generate a preview to update the content.");
  };
  
  // Use effect to fetch posts on component mount
  useEffect(() => {
    if (session) {
      fetchExistingPosts();
    }
  }, [session]);

  // Handle AI prompt requests
  const handleAIPrompt = async (prompt: string) => {
    // This function is no longer needed as the AI chat assistant now handles everything internally
    console.log("Blog: AI prompt handling now happens within the chat component");
  };

  // Generate bilingual content preview
  const generatePreview = async () => {
    if (!formValues.title || !formValues.content) {
      showAlert("Please provide both title and content before generating a preview.");
      return;
    }
    
    setAiLoading(true);
    try {
      // First, try to upload the image if there is one
      let previewImageUrl = imageUrl;
      
      // Debug: Check if we have a file input and files
      if (imageInputRef.current) {
        console.log("Blog: Image input ref exists");
        console.log("Blog: Has files:", !!imageInputRef.current.files?.length);
        if (imageInputRef.current.files?.length) {
          console.log("Blog: File details:", {
            name: imageInputRef.current.files[0].name,
            type: imageInputRef.current.files[0].type,
            size: imageInputRef.current.files[0].size
          });
        }
      } else {
        console.log("Blog: Image input ref is null");
      }
      
      // First check if we have files from the form
      const formData = new FormData();
      const imageFile = imageInputRef.current?.files?.[0];
      
      if (!previewImageUrl && imageFile) {
        console.log("Blog: Found image file for preview, attempting upload");
        formData.append("image", imageFile);
        
        // Log FormData contents
        console.log("Blog: FormData created with image");
        for (const [key, value] of formData.entries()) {
          console.log(`Blog: FormData entry - ${key}:`, value instanceof File ? 
            `File(${value.name}, ${value.type}, ${value.size} bytes)` : value);
        }
        
        try {
          console.log("Blog: Sending upload request to /api/upload...");
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          
          console.log("Blog: Upload response status:", uploadRes.status);
          if (!uploadRes.ok) {
            const errorText = await uploadRes.text();
            console.error("Blog: Image upload for preview failed:", errorText);
            showAlert(`Image upload failed: ${errorText}`);
            // Continue without image
          } else {
            const uploadJson = await uploadRes.json();
            console.log("Blog: Preview image uploaded successfully:", uploadJson.url);
            if (!uploadJson.url) {
              console.error("Blog: Missing image URL in response");
              showAlert("Image uploaded but no URL was returned");
            } else {
              previewImageUrl = uploadJson.url;
              setImageUrl(previewImageUrl);
              
              // Apply the proper region if needed
              if (previewImageUrl && previewImageUrl.includes('digitaloceanspaces.com')) {
                const urlParts = previewImageUrl.split('/');
                const domainPart = urlParts[2]; // e.g., "bucket.region.digitaloceanspaces.com"
                
                // Check if the URL is missing region
                if (!domainPart.match(/[^.]+\.[^.]+\.digitaloceanspaces\.com/)) {
                  // Extract bucket name
                  const bucketName = domainPart.split('.')[0];
                  // Default to sfo3 as the region
                  previewImageUrl = previewImageUrl.replace(
                    `https://${bucketName}.digitaloceanspaces.com`, 
                    `https://${bucketName}.sfo3.digitaloceanspaces.com`
                  );
                  setImageUrl(previewImageUrl);
                  console.log("Blog: Fixed preview image URL with region:", previewImageUrl);
                }
              }
            }
          }
        } catch (uploadError: any) {
          console.error("Blog: Upload request error:", uploadError);
          showAlert(`Image upload error: ${uploadError.message || "Unknown error"}`);
          // Continue preview generation even if image upload fails
        }
      } else if (previewImageUrl) {
        console.log("Blog: Using existing image URL:", previewImageUrl);
      } else {
        console.log("Blog: No image to upload for preview");
        // Alert user that no image was selected
        showAlert("No image selected. You will need to upload an image before publishing.");
      }
      
      // Check if we should bypass OpenAI when editing
      if (editMode && bypassOpenAI && selectedPost) {
        console.log("Blog: Bypassing OpenAI call in edit mode");
        
        // Make sure all fields from the form are used
        const titleEn = formValues.title || "";
        let titleKo = selectedPost.titleKo || "";
        
        // Clean up the Korean title if it appears to contain English metadata or is empty
        if (titleKo.includes("TITLE_EN:")) {
          console.log("Blog: Cleaning up Korean title that contains English metadata");
          titleKo = titleKo.replace(/TITLE_EN:.*$/, "").trim();
        }
        
        if (!titleKo && selectedPost.rawContent) {
          // Try to extract the Korean title directly from the raw content
          const titleKoMatch = selectedPost.rawContent.match(/title:\s*\n\s*ko:\s*['"]([^]*?)['"](?:\s|$)/);
          if (titleKoMatch) {
            titleKo = titleKoMatch[1].replace(/''/g, "'");
            console.log("Blog: Extracted Korean title directly from raw content:", titleKo);
          }
          
          // Try more methods if title is still missing
          if (!titleKo) {
            // Try to extract from content div
            const koContentMatch = selectedPost.rawContent.match(/<div class="ko-content"[^>]*>(?:\s*<h1>(.*?)<\/h1>)?\s*([\s\S]*?)<\/div>/);
            if (koContentMatch && koContentMatch[1]) {
              titleKo = koContentMatch[1].trim();
              console.log("Blog: Extracted Korean title from content h1 in bypass mode:", titleKo);
            }
            
            // Try looking for Korean characters
            if (!titleKo) {
              const koreanTextMatches = selectedPost.rawContent.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]+[^<>\n]*[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/g);
              if (koreanTextMatches && koreanTextMatches.length > 0) {
                const potentialTitle = koreanTextMatches.find((text: string) => text.length > 10);
                if (potentialTitle) {
                  titleKo = potentialTitle.trim();
                  console.log("Blog: Extracted Korean title from raw Korean text in bypass mode:", titleKo);
                }
              }
            }
          }
        }
        
        const contentEn = formValues.content || "";
        let contentKo = selectedPost.contentKo || "";
        
        // Clean up the content fields by removing any spacers or comments
        contentKo = contentKo.replace(/\{\s*'\s*\}\s*\n*/g, "\n").replace(/\{\/\*\s*.*?\*\/\}/g, "");
        
        const author = formValues.author || "Admin";
        const category = formValues.category || "Education";
        const tags = formValues.tags || "Education,Learning";
        
        console.log("Blog: Using bypass with selectedPost:", {
          originalTitleKo: selectedPost.titleKo,
          cleanedTitleKo: titleKo,
          originalExcerptEn: selectedPost.excerptEn,
          originalExcerptKo: selectedPost.excerptKo
        });
        
        // Make sure we have excerpts for both languages
        let excerptEn = selectedPost.excerptEn || "";
        let excerptKo = selectedPost.excerptKo || "";
        
        // If excerpts are missing, try to extract them from raw content
        if ((!excerptEn || !excerptKo) && selectedPost.rawContent) {
          const excerptEnMatch = selectedPost.rawContent.match(/excerpt:\s*\n\s*en:\s*['"]([^]*?)['"](?:\s|$)/);
          const excerptKoMatch = selectedPost.rawContent.match(/excerpt:\s*\n\s*ko:\s*['"]([^]*?)['"](?:\s|$)/);
          
          if (excerptEnMatch && !excerptEn) {
            excerptEn = excerptEnMatch[1].replace(/''/g, "'");
            console.log("Blog: Extracted English excerpt directly from raw content");
          }
          
          if (excerptKoMatch && !excerptKo) {
            excerptKo = excerptKoMatch[1].replace(/''/g, "'");
            console.log("Blog: Extracted Korean excerpt directly from raw content");
          }
          
          // Try to extract from content if still missing
          if (!excerptKo) {
            // Try to find excerpt from Korean content div
            const koContentMatch = selectedPost.rawContent.match(/<div class="ko-content"[^>]*>(?:\s*<h1>.*?<\/h1>)?\s*([\s\S]*?)<\/div>/);
            if (koContentMatch) {
              const firstParagraphMatch = koContentMatch[1].match(/<p>(.*?)<\/p>/);
              if (firstParagraphMatch) {
                excerptKo = firstParagraphMatch[1].substring(0, 100).trim();
                if (firstParagraphMatch[1].length > 100) excerptKo += '...';
                console.log("Blog: Extracted Korean excerpt from content p in bypass mode");
              }
            }
            
            // Try looking for Korean text blocks if still missing
            if (!excerptKo) {
              const koreanTextMatches = selectedPost.rawContent.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]+[^<>\n]*[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/g);
              if (koreanTextMatches && koreanTextMatches.length > 1) {
                // Try to find a longer text for excerpt, different from title
                const potentialExcerpt = koreanTextMatches
                  .filter((text: string) => text !== titleKo && text.length > 15)
                  .sort((a: string, b: string) => b.length - a.length)[0]; // Use the longest match
                
                if (potentialExcerpt) {
                  excerptKo = potentialExcerpt.trim();
                  if (excerptKo.length > 100) excerptKo = excerptKo.substring(0, 100) + '...';
                  console.log("Blog: Extracted Korean excerpt from raw Korean text in bypass mode");
                }
              }
            }
          }
        }
        
        // Fallback defaults if still missing
        if (!excerptEn) {
          excerptEn = "This is an educational blog post about " + titleEn;
        }
        
        if (!excerptKo) {
          excerptKo = "이것은 " + (titleKo || "교육") + "에 관한 교육 블로그 포스트입니다";
        }
        
        // Create a preview object with updated fields
        setPreview(ensureCompletePreview({
          titleEn: titleEn,
          titleKo: titleKo,
          excerptEn: excerptEn,
          excerptKo: excerptKo,
          contentEn: contentEn,
          contentKo: contentKo
        }));
        
        // Generate markdown manually with the updated fields - ensuring proper YAML frontmatter format
        const newMarkdown = `---
title:
  en: '${titleEn.replace(/'/g, "''")}'
  ko: '${titleKo.replace(/'/g, "''")}'
date: '${new Date().toISOString().split('T')[0]}'
author: '${author}'
image:
  src: '${previewImageUrl}'
  alt: '${titleEn.replace(/'/g, "''")}'
excerpt:
  en: '${excerptEn.replace(/'/g, "''")}'
  ko: '${excerptKo.replace(/'/g, "''")}'
category: '${category}'
authorImage: 'https://bageledu.sfo3.cdn.digitaloceanspaces.com/hyejeong.jpg'
tags:
  [${tags.split(",").map((tag: string) => `'${tag.trim().replace(/'/g, "''")}'`).join(", ")}]
---

<div class="en-content" x-show="$store.language !== 'ko'">
  <h1>${titleEn}</h1>
${contentEn.replace(/\{\s*'\s*\}\s*\n*/g, "\n").replace(/\{\/\*\s*.*?\*\/\}/g, "")}
</div>

<div class="ko-content" x-show="$store.language === 'ko'">
  <h1>${titleKo}</h1>
${contentKo}
</div>`;

        console.log("Blog: Generated markdown in bypass mode:", {
          titleLength: titleEn.length,
          koTitleLength: titleKo.length,
          enExcerptLength: excerptEn.length,
          koExcerptLength: excerptKo.length
        });
        
        setRawMarkdown(newMarkdown);
        showAlert("Content has been updated. Check the preview tab.");
      } else {
        // Generate preview with OpenAI
        console.log("Blog: Generating preview with OpenAI, image URL:", previewImageUrl);
        const response = await fetch("/api/openai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: formValues.content,
            title: formValues.title,
            category: formValues.category,
            tags: formValues.tags,
            author: formValues.author,
            imageUrl: previewImageUrl // Use the uploaded image URL
          }),
        });
        
        if (!response.ok) {
          throw new Error("Failed to generate preview");
        }
        
        const data = await response.json();
        
        if (data.parsed) {
          setPreview(ensureCompletePreview(data.parsed));
          if (data.markdown) {
            setRawMarkdown(data.markdown);
          }
          showAlert("Bilingual content has been generated. Check the preview tab.");
        }
      }
    } catch (error: any) {
      showAlert(error.message || "Failed to generate preview");
    } finally {
      setAiLoading(false);
    }
  };

  // Submit the form
  const onSubmit = async (data: any) => {
    if (!preview) {
      showAlert("Please generate a preview before publishing");
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccess(false);
    
    try {
      // Handle image upload if present
      let uploadedImageUrl = imageUrl;
      
      // Ensure we have an image
      if (!uploadedImageUrl && (!data.image || !data.image[0])) {
        throw new Error("Featured image is required. Please upload an image before publishing.");
      }
      
      if (data.image && data.image[0]) {
        console.log("Blog: Image file found, preparing for upload:", {
          name: data.image[0].name,
          type: data.image[0].type,
          size: data.image[0].size + " bytes"
        });
        
        const formData = new FormData();
        formData.append("image", data.image[0]);
        console.log("Blog: FormData created with image");
        
        try {
          console.log("Blog: Sending upload request to /api/upload...");
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          
          console.log("Blog: Upload response status:", uploadRes.status);
          if (!uploadRes.ok) {
            const errorText = await uploadRes.text();
            console.error("Blog: Upload failed:", errorText);
            throw new Error(`Image upload failed: ${uploadRes.status} ${errorText}`);
          }
          
          const uploadJson = await uploadRes.json();
          console.log("Blog: Upload successful, received URL:", uploadJson.url);
          
          // Validate image URL
          if (!uploadJson.url) {
            throw new Error("Image upload succeeded but no URL was returned");
          }
          
          uploadedImageUrl = uploadJson.url;
          setImageUrl(uploadedImageUrl);
        } catch (uploadError: any) {
          console.error("Blog: Upload request error:", uploadError);
          throw new Error("Image upload request failed: " + (uploadError.message || "Unknown error"));
        }
      } else if (uploadedImageUrl) {
        console.log("Blog: Using previously uploaded image URL:", uploadedImageUrl);
        
        // Validate the existing image URL
        try {
          const checkImage = await fetch(uploadedImageUrl, { method: 'HEAD' });
          if (!checkImage.ok) {
            console.error("Blog: Image validation failed - image may not exist:", uploadedImageUrl);
            throw new Error("The previously uploaded image cannot be accessed. Please try uploading again.");
          }
        } catch (error) {
          console.error("Blog: Image validation error:", error);
          // Continue anyway, as the image might still be processing
        }
      }
      
      // Ensure the image URL is properly formatted
      if (uploadedImageUrl && uploadedImageUrl.includes('digitaloceanspaces.com')) {
        const urlParts = uploadedImageUrl.split('/');
        const domainPart = urlParts[2]; // e.g., "bucket.region.digitaloceanspaces.com"
        
        // Check if the URL is missing region
        if (!domainPart.match(/[^.]+\.[^.]+\.digitaloceanspaces\.com/)) {
          // Extract bucket name
          const bucketName = domainPart.split('.')[0];
          // Default to sfo3 as the region
          uploadedImageUrl = uploadedImageUrl.replace(
            `https://${bucketName}.digitaloceanspaces.com`, 
            `https://${bucketName}.sfo3.digitaloceanspaces.com`
          );
          setImageUrl(uploadedImageUrl);
          console.log("Blog: Fixed image URL with region:", uploadedImageUrl);
        }
      }
      
      if (!uploadedImageUrl) {
        throw new Error("No valid image URL available. Please upload an image.");
      }
      
      // Generate the markdown and post to GitHub
      console.log("Blog: Calling OpenAI API with image URL:", uploadedImageUrl);
      const response = await fetch("/api/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: data.content,
          title: data.title,
          author: data.author,
          category: data.category,
          tags: data.tags,
          imageUrl: uploadedImageUrl,
          parsed: preview
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate content");
      }
      
      const generatedData = await response.json();
      
      // Post to GitHub - use the same path when updating
      const slug = editMode && selectedPost ? selectedPost.name.replace('.md', '') : slugify(preview.titleEn || data.title);
      const filePath = `src/content/blog/${slug}.md`;
      
      const githubResponse = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown: generatedData.markdown,
          path: filePath,
          message: `docs: ${editMode ? 'update' : 'add'} post '${data.title}'`,
        }),
      });
      
      if (!githubResponse.ok) {
        let errorMessage = "GitHub commit failed";
        try {
          const errorData = await githubResponse.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `GitHub API error: ${githubResponse.status}`;
        }
        throw new Error(errorMessage);
      }
      
      let commitUrl = "";
      try {
        const responseData = await githubResponse.json();
        commitUrl = responseData.commitUrl || "Successfully published";
      } catch (e) {
        console.error("Error parsing GitHub response:", e);
        // Continue even if parsing fails, as the commit was successful
      }
      
      setSuccess(true);
      reset();
      setImageUrl("");
      setPreview(null);
      setEditMode(false);
      setSelectedPost(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      
      // Refresh the posts list
      fetchExistingPosts();
      
      showAlert(`Your blog post has been ${editMode ? 'updated' : 'published'}.`);
    } catch (e: any) {
      setError(e.message || "An error occurred");
      showAlert(e.message || "Failed to publish your post");
    } finally {
      setLoading(false);
    }
  };

  // Cancel edit mode
  const cancelEdit = () => {
    setEditMode(false);
    setSelectedPost(null);
    reset();
    setImageUrl("");
    setPreview(null);
    setRawMarkdown("");
  };

  // Add a function to handle post deletion
  const handleDeletePost = async (post: any) => {
    if (!post || !post.path) {
      showAlert("Invalid post selected for deletion");
      return;
    }
    
    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete the post "${post.titleEn || post.name}"? This action cannot be undone.`)) {
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch("/api/github", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: post.path,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete post");
      }
      
      const result = await response.json();
      showAlert(result.message || "Post deleted successfully");
      
      // Refresh the posts list
      setSelectedPost(null);
      cancelEdit();
      fetchExistingPosts();
    } catch (error: any) {
      showAlert(`Error deleting post: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">
          <div className="h-8 w-32 bg-gray-200 rounded-md mb-4"></div>
          <div className="h-64 w-96 bg-gray-100 rounded-md"></div>
        </div>
      </div>
    );
  }
  
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-[350px] shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Blog Creator</CardTitle>
            <p className="text-sm text-gray-500">You must be signed in to create blog posts</p>
          </CardHeader>
          <CardFooter className="flex justify-center pb-6">
            <Button 
              onClick={() => signIn()} 
              className="w-full"
              size="lg"
            >
              Sign in with Google
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">{editMode ? 'Edit' : 'Create a New'} Blog Post</h1>
      
      {/* Post selection dropdown for editing */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row gap-6 items-center bg-white p-8 rounded-lg shadow-sm border border-gray-100">
          <div className="flex-1 w-full">
            <Label htmlFor="postSelect" className="text-base font-medium mb-2 block">Select a post to edit</Label>
            <select 
              id="postSelect"
              className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              onChange={(e) => {
                const selectedPost = existingPosts.find(post => post.path === e.target.value);
                if (selectedPost) {
                  loadPostData(selectedPost);
                } else {
                  cancelEdit();
                }
              }}
              value={selectedPost?.path || ""}
            >
              <option value="">-- Create new post --</option>
              {existingPosts.map(post => (
                <option key={post.path} value={post.path}>
                  {post.titleEn || post.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex gap-3 mt-4 md:mt-0 self-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={fetchExistingPosts}
              disabled={postsLoading}
              className="min-w-[120px]"
            >
              {postsLoading ? (
                <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 3v5m0 0h-5m5 0-3-2.708A9 9 0 1 0 20.777 14"/></svg>
              )}
              Refresh Posts
            </Button>
            
            {selectedPost && (
              <Button 
                type="button" 
                variant="destructive"
                onClick={() => handleDeletePost(selectedPost)}
                disabled={loading}
                className="min-w-[120px] bg-red-600 hover:bg-red-700 text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Delete Post
              </Button>
            )}
            
            {editMode && (
              <Button 
                type="button" 
                variant="secondary"
                onClick={cancelEdit}
                className="min-w-[120px]"
              >
                Cancel Editing
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* OpenAI Bypass Option - Updated design */}
      {editMode && (
        <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-lg">OpenAI Translation</h3>
                <p className="text-gray-600">Toggle this option to bypass OpenAI when making minor updates</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="font-medium text-sm text-gray-700">{bypassOpenAI ? 'Disabled' : 'Enabled'}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox"
                  value=""
                  className="sr-only peer"
                  checked={!bypassOpenAI}
                  onChange={() => setBypassOpenAI(!bypassOpenAI)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      )}
      
      <Tabs defaultValue="content" className="space-y-6">
        <TabsList className="w-full grid grid-cols-2 p-1 h-12 bg-gray-100 rounded-lg">
          <TabsTrigger 
            value="content" 
            className="rounded-md h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium"
          >
            Content
          </TabsTrigger>
          <TabsTrigger 
            value="preview" 
            className="rounded-md h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium"
          >
            Bilingual Preview
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="content" className="p-8 bg-white rounded-lg shadow-sm border border-gray-100 mt-4">
          <form className="space-y-6" onSubmit={(e) => {
            e.preventDefault();
            generatePreview();
          }}>
            <div className="space-y-5">
              <div>
                <Label htmlFor="title" className="text-base font-medium mb-2 block">Title</Label>
                <Input
                  id="title"
                  placeholder="Enter your blog post title"
                  className="h-10 px-3 py-2 text-base"
                  {...register("title", { required: true })}
                />
                {errors.title && (
                  <p className="text-sm text-red-500 mt-1">Title is required</p>
                )}
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="content" className="text-base font-medium">Content</Label>
                  <span className="text-sm text-gray-500">Enter in any language, AI will detect and translate</span>
                </div>
                <Textarea
                  id="content"
                  placeholder="Write your blog post content (in any language)"
                  className="min-h-[350px] text-base px-3 py-2"
                  {...register("content", { required: true })}
                />
                {errors.content && (
                  <p className="text-sm text-red-500 mt-1">Content is required</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="category" className="text-base font-medium mb-2 block">Category</Label>
                <Input
                  id="category"
                  placeholder="e.g. College Planning"
                  className="h-10 px-3 py-2 text-base"
                  {...register("category", { required: true })}
                />
                {errors.category && (
                  <p className="text-sm text-red-500 mt-1">Category is required</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="tags" className="text-base font-medium mb-2 block">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  placeholder="e.g. College, Planning, Education"
                  className="h-10 px-3 py-2 text-base"
                  {...register("tags", { required: true })}
                />
                {errors.tags && (
                  <p className="text-sm text-red-500 mt-1">At least one tag is required</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="author" className="text-base font-medium mb-2 block">Author</Label>
                <Input
                  id="author"
                  placeholder="Your name"
                  className="h-10 px-3 py-2 text-base"
                  {...register("author", { required: true })}
                />
                {errors.author && (
                  <p className="text-sm text-red-500 mt-1">Author is required</p>
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="image" className="text-base font-medium mb-2 block">Featured Image</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                className="h-auto py-2"
                {...register("image", { required: !imageUrl })}
                ref={imageInputRef}
              />
              {errors.image && (
                <p className="text-sm text-red-500 mt-1">Featured image is required</p>
              )}
              {imageUrl && (
                <div className="mt-3">
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-200 px-3 py-1 font-medium">Image Uploaded</Badge>
                  <div className="mt-3 border rounded-lg overflow-hidden">
                    <img src={imageUrl} alt="Preview" className="h-48 w-full object-cover" />
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end pt-6">
              <Button
                type="submit"
                disabled={aiLoading}
                className="min-w-[200px] py-5 text-base font-medium"
              >
                {aiLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Preview...
                  </span>
                ) : (
                  `Generate ${editMode ? 'Updated' : 'Bilingual'} Preview`
                )}
              </Button>
            </div>
          </form>
        </TabsContent>
        
        <TabsContent value="preview" className="bg-white rounded-lg shadow-sm border border-gray-100 mt-4">
          <div className="p-8">
            {!preview ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] border-2 border-dashed border-gray-200 rounded-md p-8 text-gray-500 bg-gray-50">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 mb-3">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <path d="M12 18v-6"></path>
                  <path d="M9 15h6"></path>
                </svg>
                <p className="text-base mb-4">Generate a preview to see the bilingual content</p>
                <Button 
                  className="mt-2 px-6" 
                  onClick={generatePreview}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </span>
                  ) : (
                    "Generate Preview"
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-10">
                {(() => {
                  // Debug logging to see what's in the preview object
                  console.log("Preview data being rendered:", {
                    titleEn: preview.titleEn || "empty",
                    titleKo: preview.titleKo || "empty",
                    excerptEn: preview.excerptEn || "empty",
                    excerptKo: preview.excerptKo || "empty", 
                    contentLengths: {
                      en: preview.contentEn?.length || 0,
                      ko: preview.contentKo?.length || 0
                    }
                  });
                  return null;
                })()}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-5">
                    <h3 className="font-semibold text-lg border-b pb-3 text-blue-700">English</h3>
                    
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Title</Label>
                      <div className="mt-1 p-3 border rounded-md bg-gray-50 text-base min-h-[42px]">
                        {preview.titleEn || "No English title available"}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Excerpt</Label>
                      <div className="mt-1 p-3 border rounded-md bg-gray-50 text-base min-h-[80px]">
                        {preview.excerptEn || "No English excerpt available"}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Content</Label>
                      <div className="mt-1 p-3 border rounded-md bg-gray-50 text-base min-h-[350px] max-h-[350px] overflow-y-auto">
                        <div dangerouslySetInnerHTML={{ __html: (preview.contentEn || "No English content available").replace(/\n/g, '<br />') }} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-5">
                    <h3 className="font-semibold text-lg border-b pb-3 text-blue-700">Korean</h3>
                    
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Title</Label>
                      <div className="mt-1 p-3 border rounded-md bg-gray-50 text-base min-h-[42px]">
                        {preview.titleKo || "No Korean title available"}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Excerpt</Label>
                      <div className="mt-1 p-3 border rounded-md bg-gray-50 text-base min-h-[80px]">
                        {preview.excerptKo || "No Korean excerpt available"}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Content</Label>
                      <div className="mt-1 p-3 border rounded-md bg-gray-50 text-base min-h-[350px] max-h-[350px] overflow-y-auto">
                        <div dangerouslySetInnerHTML={{ __html: (preview.contentKo || "No Korean content available").replace(/\n/g, '<br />') }} />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Add image preview section */}
                {imageUrl && (
                  <div className="mt-6">
                    <h3 className="font-semibold text-lg mb-3 text-blue-700">Featured Image</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <img src={imageUrl} alt="Featured Image" className="w-full max-h-[350px] object-cover" />
                    </div>
                  </div>
                )}
                
                <div className="flex justify-center mt-6">
                  <Button 
                    onClick={generatePreview} 
                    variant="outline"
                    disabled={aiLoading}
                    className="min-w-[200px]"
                  >
                    {aiLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Regenerating...
                      </span>
                    ) : (
                      "Regenerate Preview"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          {preview && (
            <>
              {/* Raw Markdown Debug Section */}
              <div className="mt-2 border-t pt-8 px-8">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-medium flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 3v4a1 1 0 0 0 1 1h4"></path>
                      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"></path>
                      <path d="M10 13v4"></path>
                      <path d="M14 13v4"></path>
                    </svg>
                    Raw Markdown Debug
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-sm"
                    onClick={() => {
                      // Copy raw markdown to clipboard
                      if (rawMarkdown) {
                        navigator.clipboard.writeText(rawMarkdown);
                        showAlert("Markdown copied to clipboard!");
                      }
                    }}
                    disabled={!rawMarkdown}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy Markdown
                  </Button>
                </div>
                <div className="bg-gray-50 border rounded-md p-4 overflow-auto max-h-[300px]">
                  <pre className="text-sm font-mono whitespace-pre-wrap" id="rawMarkdown">
                    {rawMarkdown || "No markdown generated yet. Press 'Generate Preview' first."}
                  </pre>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-8 px-8 pb-8 border-t mt-6">
                <Button
                  onClick={handleSubmit(onSubmit)}
                  className="flex-1 py-5 text-base font-medium"
                  disabled={loading || !preview}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {editMode ? 'Updating...' : 'Publishing...'}
                    </span>
                  ) : (
                    editMode ? 'Update Blog Post' : 'Publish Blog Post'
                  )}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (editMode) {
                      cancelEdit();
                    } else {
                      reset();
                      setPreview(null);
                      setImageUrl("");
                      if (imageInputRef.current) imageInputRef.current.value = "";
                    }
                  }}
                  disabled={loading}
                  className="py-5 min-w-[150px] text-base font-medium"
                >
                  {editMode ? 'Cancel Edit' : 'Reset Form'}
                </Button>
              </div>
              
              {error && (
                <div className="px-6 pb-6">
                  <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
                    {error}
                  </div>
                </div>
              )}
              
              {success && (
                <div className="px-6 pb-6">
                  <div className="p-4 bg-green-50 text-green-700 rounded-md border border-green-200">
                    Your blog post has been {editMode ? 'updated' : 'published'} successfully!
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
      
      {/* AI Chat Bubble Helper */}
      <AIChatAssistant 
        isLoading={aiLoading} 
        initialMessage="I can help you with blog ideas, content structure, and suggestions. What would you like assistance with?"
      />
    </div>
  );
} 