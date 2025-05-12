"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession, signIn } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AIChatAssistant from "@/app/components/AIChatAssistant";
import ReactMarkdown from "react-markdown";
import { imageUrlValidation } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

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
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  
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

  // Simple toast alternative
  const showNotification = (message: string, type: "default" | "success" | "error" = "default") => {
    if (type === "error") {
      toast.error(message);
    } else if (type === "success") {
      toast.success(message);
    } else {
      toast(message);
    }
  };

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
      showNotification("Failed to load existing posts: " + (error.message || "Unknown error"), "error");
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
    
    showNotification("Post loaded for editing. Generate a preview to update the content.");
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
      showNotification("Please provide both title and content before generating a preview.", "error");
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
            showNotification(`Image upload failed: ${errorText}`, "error");
            // Continue without image
          } else {
            const uploadJson = await uploadRes.json();
            console.log("Blog: Preview image uploaded successfully:", uploadJson.url);
            if (!uploadJson.url) {
              console.error("Blog: Missing image URL in response");
              showNotification("Image uploaded but no URL was returned", "error");
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
          showNotification(`Image upload error: ${uploadError.message || "Unknown error"}`, "error");
          // Continue preview generation even if image upload fails
        }
      } else if (previewImageUrl) {
        console.log("Blog: Using existing image URL:", previewImageUrl);
      } else {
        console.log("Blog: No image to upload for preview");
        // Alert user that no image was selected
        showNotification("No image selected. You will need to upload an image before publishing.", "error");
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
        showNotification("Content has been updated. Check the preview tab.", "success");
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
          showNotification("Bilingual content has been generated. Review it in the preview tab before publishing.", "success");
        }
      }
    } catch (error: any) {
      showNotification(error.message || "Failed to generate preview", "error");
    } finally {
      setAiLoading(false);
    }
  };

  // Submit the form
  const onSubmit = async (data: any) => {
    if (!preview) {
      showNotification("Please generate a preview before publishing", "error");
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
      
      showNotification(`Your blog post has been ${editMode ? 'updated' : 'published'}.`, "success");
    } catch (e: any) {
      setError(e.message || "An error occurred");
      showNotification(e.message || "Failed to publish your post", "error");
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
      showNotification("Invalid post selected for deletion", "error");
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
      showNotification(result.message || "Post deleted successfully", "success");
      
      // Refresh the posts list
      setSelectedPost(null);
      cancelEdit();
      fetchExistingPosts();
    } catch (error: any) {
      showNotification(`Error deleting post: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Direct submit without going through the preview step (for when preview already exists)
  const handleSubmitDirectly = async () => {
    if (preview) {
      await handleSubmit(onSubmit)();
    } else {
      showNotification("Please generate a preview first before publishing.", "error");
    }
  };

  // Easter egg state
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [easterEggCount, setEasterEggCount] = useState(0);
  const easterEggTimeout = useRef<NodeJS.Timeout | null>(null);

  // Easter egg handler
  const triggerEasterEgg = () => {
    setShowEasterEgg(true);
    setEasterEggCount(prev => prev + 1);
    
    // Clear any existing timeout
    if (easterEggTimeout.current) {
      clearTimeout(easterEggTimeout.current);
    }
    
    // Hide after 5 seconds
    easterEggTimeout.current = setTimeout(() => {
      setShowEasterEgg(false);
    }, 5000);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (easterEggTimeout.current) {
        clearTimeout(easterEggTimeout.current);
      }
    };
  }, []);

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
          <div className="flex justify-center p-4">
            <img 
              src="https://www.bageledu.com/images/bageledu/BagelEducation6.png" 
              alt="BagelEdu Logo" 
              className="h-10"
            />
          </div>
          <CardDescription>
            Access the content editor to create bilingual blog posts
          </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center pb-6">
            <Button 
              onClick={() => signIn("google", { callbackUrl: window.location.href })} 
              className="w-full bg-black text-white hover:bg-gray-800 pointer-events-auto"
              size="lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
              Sign in with Google
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 sm:py-10 px-4 sm:px-8 max-w-6xl">
      {/* Toast component */}
      <Toaster />
      
      {/* Easter egg animation */}
      <AnimatePresence>
        {showEasterEgg && (
          <>
            {/* Debug indicator to see if state is changing */}
            <div className="fixed top-0 left-0 bg-red-500 text-white p-2 z-50">
              Easter Egg Activated! Count: {easterEggCount}
            </div>
            
            <motion.div 
              className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ y: -100, scale: 0, rotate: 0 }}
                animate={{ 
                  y: 0, 
                  scale: 1, 
                  rotate: easterEggCount % 3 === 0 ? [0, -10, 10, -10, 0] : [0, 10, -10, 10, 0]
                }}
                transition={{ 
                  y: { type: "spring", bounce: 0.5 },
                  scale: { duration: 0.8 },
                  rotate: { duration: 1 }
                }}
                className="relative"
              >
                <motion.img 
                  src="https://bageledu.sfo3.cdn.digitaloceanspaces.com/hyejeong-removebg-preview.png" 
                  alt="HJ" 
                  className="h-64 w-auto"
                  animate={{ 
                    scale: [1, 1.05, 1],
                    y: [0, -5, 0]
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2
                  }}
                />
                <motion.div 
                  className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-white px-6 py-2 rounded-full shadow-lg whitespace-nowrap"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <p className="text-sm font-bold text-pink-500">💕 YD says hi! and Love you 💕</p>
                </motion.div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {session && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2 sm:gap-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">BagelEdu Content Studio</h1>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                onClick={fetchExistingPosts} 
                variant="outline" 
                className="bg-white hover:bg-gray-50 text-black font-medium border border-gray-200 hover:border-gray-300 shadow-sm transition-all w-1/2 sm:w-auto flex items-center gap-2"
                disabled={postsLoading}
              >
                {postsLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <span>Load Existing Posts</span>
                  </>
                )}
              </Button>
              <Button
                onClick={() => { 
                  setEditMode(false);
                  setSelectedPost(null);
                  reset();
                  setImageUrl("");
                  setPreview(null);
                  setRawMarkdown("");
                }}
                variant="outline"
                className="bg-white hover:bg-gray-50 text-black font-medium border border-gray-200 hover:border-gray-300 shadow-sm transition-all w-1/2 sm:w-auto flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span>New Post</span>
              </Button>
            </div>
          </div>
          
          {/* Show existing posts if available */}
          {existingPosts.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Recently uploaded Posts</h2>
              <div className={`${existingPosts.length > 3 ? 'flex overflow-x-auto pb-4 snap-x snap-mandatory' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'} gap-4`}>
                {existingPosts.map((post) => (
                  <Card 
                    key={post.path} 
                    className={`border border-gray-200 shadow-sm hover:shadow transition-shadow ${existingPosts.length > 3 ? 'flex-shrink-0 w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)] snap-start' : ''} flex flex-col`}
                  >
                    <div className="relative aspect-[16/10] overflow-hidden rounded-t-md bg-gray-100">
                      {post.image ? (
                        <img 
                          src={imageUrlValidation(post.image) ? post.image : "https://bageledu.sfo3.cdn.digitaloceanspaces.com/bageledu-og-image-v3.webp"} 
                          alt={post.titleEn || "Featured image"} 
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <img src="https://bageledu.sfo3.cdn.digitaloceanspaces.com/bageledu-og-image-v3.webp" alt="Bagel Edu" className="object-cover w-full h-full" />
                      )}
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-white text-gray-800 shadow-sm">{post.category || "Uncategorized"}</Badge>
                      </div>
                    </div>
                    <CardContent className="p-4 flex-1 flex flex-col">
                      <div className="mb-2">
                        <h3 className="font-semibold text-lg line-clamp-2">{post.titleEn || "(No title)"}</h3>
                        <p className="text-sm text-gray-500 mt-1 mb-2">
                          {post.date ? new Date(post.date).toLocaleDateString() : "No date"} • {post.author || "Anonymous"}
                        </p>
                        <p className="text-sm text-gray-700 line-clamp-2">{post.excerptEn || "(No excerpt)"}</p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {post.tags && post.tags.split(",").map((tag: string, i: number) => (
                          <Badge key={i} className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200">
                            {tag.trim()}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-auto pt-4">
                        <Button 
                          onClick={() => loadPostData(post)} 
                          className="flex-1 bg-black hover:bg-gray-800 text-white"
                        >
                          Edit
                        </Button>
                        <Button 
                          onClick={() => handleDeletePost(post)} 
                          variant="outline" 
                          className="bg-white text-black hover:bg-gray-100 border-gray-200"
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {existingPosts.length > 3 && (
                <p className="text-sm text-gray-500 mt-2 text-center">
                  Swipe to see more posts
                </p>
              )}
            </div>
          )}

          <AIChatAssistant 
            isLoading={loading || aiLoading}
            initialMessage="I'm your blog post assistant. I can help you with ideas, content structure, or any questions about creating bilingual blog posts. What would you like help with?"
          />

          <Tabs defaultValue="edit" className="w-full">
            <div className="mb-4">
              <TabsList>
                <TabsTrigger value="edit" className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Edit Content
                </TabsTrigger>
                <TabsTrigger value="preview" className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  Preview Content
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="edit" className="focus-visible:outline-none focus-visible:ring-0">
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="title" className="font-medium">Title</Label>
                        <Input
                          id="title"
                          placeholder="Post title..."
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          {...register("title", { required: true })}
                        />
                        {errors.title && <span className="text-red-500 text-sm">Required</span>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="category" className="font-medium">Category</Label>
                        <Input
                          id="category"
                          placeholder="e.g. College Planning"
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          {...register("category", { required: true })}
                        />
                        {errors.category && <span className="text-red-500 text-sm">Required</span>}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="author" className="font-medium">Author</Label>
                        <Input
                          id="author"
                          placeholder="Author name"
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          {...register("author", { required: true })}
                        />
                        {errors.author && <span className="text-red-500 text-sm">Required</span>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="tags" className="font-medium">Tags (comma separated)</Label>
                        <Input
                          id="tags"
                          placeholder="tag1, tag2, tag3"
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          {...register("tags", { required: true })}
                        />
                        {errors.tags && <span className="text-red-500 text-sm">Required</span>}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="content" className="font-medium">Blog Post Content</Label>
                      <Textarea
                        id="content"
                        placeholder="Your content in markdown..."
                        rows={12}
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-h-[200px] font-mono text-sm"
                        {...register("content", { required: true })}
                      />
                      {errors.content && <span className="text-red-500 text-sm">Required</span>}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="image" className="font-medium">Featured Image</Label>
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        {...register("image", { required: !imageUrl && !editMode })}
                        ref={imageInputRef}
                      />
                      {errors.image && <span className="text-red-500 text-sm">Required</span>}
                      {imageUrl && (
                        <div className="mt-2 relative rounded-md overflow-hidden border border-gray-200">
                          <img src={imageUrl} alt="Uploaded" className="max-h-40 w-full object-cover" />
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-white text-gray-800 hover:bg-gray-100 shadow-sm">Uploaded</Badge>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="flex items-center w-full sm:w-auto bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 transition-all hover:bg-gray-100">
                        <label htmlFor="bypass" className="flex items-center cursor-pointer">
                          <div className="relative">
                            <input 
                              type="checkbox" 
                              id="bypass" 
                              checked={bypassOpenAI} 
                              onChange={() => setBypassOpenAI(!bypassOpenAI)}
                              className="sr-only"
                            />
                            <div className={`block w-12 h-6 rounded-full transition-colors duration-200 ease-in-out ${bypassOpenAI ? 'bg-black' : 'bg-gray-300'}`}></div>
                            <div className={`absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full transition-transform duration-200 ease-in-out ${bypassOpenAI ? 'transform translate-x-6' : ''}`}></div>
                          </div>
                          <div className="ml-4">
                            <span className="text-sm font-medium text-gray-800">Skip AI generation</span>
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-800">Manual content</span>
                          </div>
                        </label>
                      </div>
                      <div className="flex-1"></div>
                      <Button
                        onClick={generatePreview}
                        className="bg-black hover:bg-gray-800 text-white px-6 py-2.5 rounded-lg shadow-sm transition-all hover:shadow flex items-center gap-2"
                        disabled={loading || aiLoading}
                      >
                        {aiLoading ? (
                          <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="font-medium">Generating...</span>
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                            <span className="font-medium">Generate Preview</span>
                          </>
                        )}
                      </Button>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="flex-1"></div>
                      <Button
                        type="submit"
                        className="w-full sm:w-auto bg-gradient-to-r from-gray-900 to-black text-white flex gap-2 items-center px-6 py-2.5 rounded-lg shadow-sm transition-all hover:shadow hover:from-black hover:to-gray-900"
                        disabled={loading || aiLoading}
                      >
                        {loading ? (
                          <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="font-medium">Publishing...</span>
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11.08V8l-6-6H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2v-3.08c.58-.77 1-1.73 1-2.92 0-1.2-.42-2.15-1-2.92z"></path><path d="M14 2v6h6"></path><path d="M22.66 15.5c0 1.8-1.77 3.5-4 3.5h-5.33c-2.23 0-4-1.7-4-3.5s1.77-3.5 4-3.5h5.33c2.23 0 4 1.7 4 3.5z"></path></svg>
                            <span className="font-medium">Publish Post</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="preview" className="focus-visible:outline-none focus-visible:ring-0">
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  {!preview ? (
                    <div className="text-center py-10">
                      <div className="mb-4 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No preview available</h3>
                      <p className="text-gray-500 mb-4">Click "Generate Preview" to see how your post will look in both languages.</p>
                      <Button
                        onClick={generatePreview}
                        className="bg-black hover:bg-gray-800 text-white px-6 py-2.5 rounded-lg shadow-sm transition-all hover:shadow flex items-center gap-2"
                        disabled={loading || aiLoading}
                      >
                        {aiLoading ? (
                          <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="font-medium">Generating...</span>
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                            <span className="font-medium">Generate Preview</span>
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Bilingual Preview</h2>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowRawMarkdown && setShowRawMarkdown(!showRawMarkdown)}
                            className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                          >
                            {showRawMarkdown ? "View Rendered" : "View Markdown"}
                          </Button>
                          <Button
                            onClick={handleSubmitDirectly}
                            size="sm"
                            className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg shadow-sm transition-all hover:shadow flex items-center gap-1"
                            disabled={loading || aiLoading}
                          >
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11.08V8l-6-6H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2v-3.08c.58-.77 1-1.73 1-2.92 0-1.2-.42-2.15-1-2.92z"></path><path d="M14 2v6h6"></path><path d="M22.66 15.5c0 1.8-1.77 3.5-4 3.5h-5.33c-2.23 0-4-1.7-4-3.5s1.77-3.5 4-3.5h5.33c2.23 0 4 1.7 4 3.5z"></path></svg>
                              <span className="font-medium">Publish Now</span>
                            </>
                          </Button>
                        </div>
                      </div>
                      
                      {/* Preview content */}
                      {showRawMarkdown ? (
                        <div className="border rounded-md p-4 bg-gray-50">
                          <pre className="text-sm font-mono whitespace-pre-wrap overflow-x-auto">
                            {rawMarkdown}
                          </pre>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* English preview */}
                          <div className="border rounded-md overflow-hidden">
                            <div className="bg-gray-100 border-b px-4 py-2 flex items-center">
                              <div className="mr-2">🇺🇸</div>
                              <div className="font-medium">English Preview</div>
                            </div>
                            <div className="p-4">
                              {imageUrl && (
                                <div className="mb-4 border rounded overflow-hidden">
                                  <img src={imageUrl} alt="Featured" className="w-full h-48 object-cover" />
                                </div>
                              )}
                              <h1 className="text-2xl font-bold mb-2">{preview.titleEn}</h1>
                              <div className="text-gray-500 italic mb-4">{preview.excerptEn}</div>
                              <div className="prose prose-sm max-w-none">
                                <ReactMarkdown>{preview.contentEn}</ReactMarkdown>
                              </div>
                            </div>
                          </div>
                          
                          {/* Korean preview */}
                          <div className="border rounded-md overflow-hidden">
                            <div className="bg-gray-100 border-b px-4 py-2 flex items-center">
                              <div className="mr-2">🇰🇷</div>
                              <div className="font-medium">Korean Preview</div>
                            </div>
                            <div className="p-4">
                              {imageUrl && (
                                <div className="mb-4 border rounded overflow-hidden">
                                  <img src={imageUrl} alt="Featured" className="w-full h-48 object-cover" />
                                </div>
                              )}
                              <h1 className="text-2xl font-bold mb-2">{preview.titleKo}</h1>
                              <div className="text-gray-500 italic mb-4">{preview.excerptKo}</div>
                              <div className="prose prose-sm max-w-none">
                                <ReactMarkdown>{preview.contentKo}</ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="pt-4 border-t border-gray-200">
                        <Button 
                          onClick={handleSubmitDirectly}
                          className="w-full sm:w-auto bg-gradient-to-r from-gray-900 to-black text-white flex gap-2 items-center px-6 py-2.5 rounded-lg shadow-sm transition-all hover:shadow hover:from-black hover:to-gray-900"
                          disabled={loading || aiLoading}
                        >
                          {loading ? (
                            <>
                              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span className="font-medium">Publishing...</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11.08V8l-6-6H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2v-3.08c.58-.77 1-1.73 1-2.92 0-1.2-.42-2.15-1-2.92z"></path><path d="M14 2v6h6"></path><path d="M22.66 15.5c0 1.8-1.77 3.5-4 3.5h-5.33c-2.23 0-4-1.7-4-3.5s1.77-3.5 4-3.5h5.33c2.23 0 4 1.7 4 3.5z"></path></svg>
                              <span className="font-medium">Publish Post</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="mt-4 bg-red-50 text-red-600 p-4 rounded-md border border-red-100">
              <p>{error}</p>
            </div>
          )}
          
          {success && (
            <div className="mt-4 bg-green-50 text-green-600 p-4 rounded-md border border-green-100">
              <p>Post published successfully!</p>
            </div>
          )}
          
          {/* Footer message with easter egg trigger */}
          <div className="flex justify-end items-center pt-8 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              Made with 
              <motion.div
                whileHover={{ scale: 1.3 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  triggerEasterEgg();
                }}
                className="cursor-pointer relative z-10 p-2 -m-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#ff0000" stroke="#ff0000" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse transition-transform duration-300 hover:scale-110 scale-105">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </motion.div>
              for HJ
            </span>
          </div>
        </div>
      )}
    </div>
  );
} 