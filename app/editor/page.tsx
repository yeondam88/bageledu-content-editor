"use client";
import { useSession, signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import AIChatAssistant from "@/app/components/AIChatAssistant";

function slugify(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "-");
}

function generateMarkdown(data: any, imageUrl: string) {
  console.log("generateMarkdown called with imageUrl:", imageUrl);
  
  if (!data) return "";
  const tagsArr = (data.tags || "").split(",").map((t: string) => t.trim()).filter(Boolean);
  
  // Get content, trim and check if it's empty
  let contentEn = (data.content_en || "").trim();
  let contentKo = (data.content_ko || "").trim();
  
  // Remove {' '} spacers that might be in the content
  contentEn = contentEn.replace(/\{\s*'\s*\}\s*\n*/g, "\n");
  contentKo = contentKo.replace(/\{\s*'\s*\}\s*\n*/g, "\n");
  
  // Ensure the image URL is properly formatted
  let formattedImageUrl = imageUrl || "";
  if (formattedImageUrl) {
    // For DigitalOcean Spaces URLs, ensure the region is specified correctly
    if (formattedImageUrl.includes('digitaloceanspaces.com')) {
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
  }
  
  return `---
title:
  en: '${(data.title_en || "").replace(/'/g, "''")}'
  ko: '${(data.title_ko || "").replace(/'/g, "''")}'
date: '${data.date || ""}'
author: '${(data.author || "").replace(/'/g, "''")}'
image:
  src: '${formattedImageUrl}'
  alt: '${(data.title_en || "").replace(/'/g, "''")}'
excerpt:
  en: '${(data.excerpt_en || "").replace(/'/g, "''")}'
  ko: '${(data.excerpt_ko || "").replace(/'/g, "''")}'
category: '${(data.category || "").replace(/'/g, "''")}'
authorImage: 'https://bageledu.sfo3.cdn.digitaloceanspaces.com/hyejeong.jpg'
tags:
  [${tagsArr.map((t: string) => `'${t.replace(/'/g, "''")}'`).join(", ")}]
---

{/* English Content */}

<div class="en-content" x-show="$store.language !== 'ko'">
${contentEn ? contentEn : ''}
</div>

{/* Korean Content */}

<div class="ko-content" x-show="$store.language === 'ko'">
${contentKo ? contentKo : ''}
</div>
`;
}

function AiGenerateButton({ 
  language, 
  type, 
  setValue, 
  loading,
  setLoading 
}: { 
  language: "en" | "ko", 
  type: "title" | "excerpt" | "content" | "all", 
  setValue: any,
  loading: boolean,
  setLoading: (loading: boolean) => void
}) {
  const [prompt, setPrompt] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!prompt) {
      setError("Please enter a prompt");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          language: language === "en" ? "English" : "Korean",
          type,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate content");
      }

      const data = await response.json();
      
      // Update form field based on type and language
      if (type === "title") {
        setValue(`title_${language}`, data.content);
      } else if (type === "excerpt") {
        setValue(`excerpt_${language}`, data.content);
      } else if (type === "content") {
        // For content-only generation, make sure we're not including titles in the content
        let content = data.content;
        
        // Remove any heading that might be at the beginning of the content
        // This prevents title duplication since titles are handled separately
        const lines = content.split('\n');
        const titleIndex = lines.findIndex((line: string) => line.startsWith('# ') || line.startsWith('## '));
        
        if (titleIndex === 0) { // Only remove if it's the first line
          content = lines.slice(1).join('\n').trim();
        }
        
        setValue(`content_${language}`, content);
      } else if (type === "all") {
        // Parse the AI response - this is simplified and might need adjustment
        const lines = data.content.split('\n');
        let title = '';
        let excerpt = '';
        let content = '';
        
        // Extract title (usually first line or line with # or ##)
        const titleIndex = lines.findIndex((line: string) => line.startsWith('# ') || line.startsWith('## '));
        if (titleIndex >= 0) {
          title = lines[titleIndex].replace(/^#+ /, '');
        } else if (lines.length > 0) {
          title = lines[0];
        }
        
        // Try to find excerpt (usually shorter paragraph after title)
        for (let i = titleIndex + 1; i < lines.length; i++) {
          if (lines[i].trim() && !lines[i].startsWith('#')) {
            excerpt = lines[i];
            break;
          }
        }
        
        // The rest is content
        content = lines.slice(Math.max(titleIndex + 1, 1)).join('\n');
        
        setValue(`title_${language}`, title);
        setValue(`excerpt_${language}`, excerpt);
        setValue(`content_${language}`, content);
      }

      setDialogOpen(false);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex items-center gap-1 bg-violet-50 border-violet-200 hover:bg-violet-100 text-violet-700"
          onClick={() => setDialogOpen(true)}
          disabled={loading}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><line x1="12" y1="22" x2="12" y2="12"></line></svg>
          AI Generate {language === "en" ? "🇺🇸" : "🇰🇷"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generate with AI ({language === "en" ? "English" : "Korean"})</DialogTitle>
          <DialogDescription>
            Enter a prompt to generate {type === "all" ? "a complete post" : `the ${type}`} in {language === "en" ? "English" : "Korean"}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Textarea
            placeholder={`e.g., Write about the importance of early college planning${language === "ko" ? " in Korean" : ""}`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !prompt}
            className="w-full"
          >
            {generating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              "Generate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AIContentGenerator({ setValue, loading, setLoading }: { setValue: any, loading: boolean, setLoading: (loading: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<"en" | "ko">("en");
  const [selectedType, setSelectedType] = useState<"title" | "excerpt" | "content" | "all">("content");

  return (
    <div className="flex flex-col sm:flex-row gap-2 mb-6">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200"
            disabled={loading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12c0 2.7 1.1 5.2 2.8 7l-.4 4 4-.4c1.8 1.8 4.3 2.8 7 2.8 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18c-2.2 0-4.3-.8-5.9-2.2l-.5-.5-.6.1-2 .2.2-2 .1-.6-.5-.5C1.8 13 1 11 1 8.9 1 6.2 2.2 3.8 4.1 2 6 .2 8.5-1 11.1-1c5 0 9 4 9 9 0 2.7-1.1 5.2-2.8 7-1.9 1.8-4.3 3-7 3z"></path></svg>
            AI Content Generator
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Generate Content with AI</h4>
              <p className="text-sm text-muted-foreground">
                Choose what content to generate and in which language.
              </p>
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-1">
                  <Label htmlFor="language">Language</Label>
                  <Select 
                    defaultValue="en" 
                    onValueChange={(value) => setSelectedLanguage(value as "en" | "ko")}
                  >
                    <SelectTrigger id="language">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="en">English 🇺🇸</SelectItem>
                      <SelectItem value="ko">Korean 🇰🇷</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1 col-span-2">
                  <Label htmlFor="type">Content Type</Label>
                  <Select 
                    defaultValue="content" 
                    onValueChange={(value) => setSelectedType(value as "title" | "excerpt" | "content" | "all")}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="title">Title Only</SelectItem>
                      <SelectItem value="excerpt">Excerpt Only</SelectItem>
                      <SelectItem value="content">Content Only</SelectItem>
                      <SelectItem value="all">Complete Post</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="pt-2">
                <AiGenerateButton 
                  language={selectedLanguage} 
                  type={selectedType} 
                  setValue={setValue}
                  loading={loading}
                  setLoading={setLoading}
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex gap-2">
        <AiGenerateButton 
          language="en" 
          type="content" 
          setValue={setValue}
          loading={loading}
          setLoading={setLoading}
        />
        <AiGenerateButton 
          language="ko" 
          type="content" 
          setValue={setValue}
          loading={loading}
          setLoading={setLoading}
        />
      </div>
    </div>
  );
}

export default function EditorPage() {
  const { data: session } = useSession({ required: true });
  
  // Redirect to sign in if no session exists
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Sign in required</h1>
        <p className="text-gray-600 mb-4">Please sign in to access the content editor.</p>
        <Button onClick={() => signIn()}>Sign in</Button>
      </div>
    );
  }
  
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");
  const [successUrl, setSuccessUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [previewMode, setPreviewMode] = useState<"edit" | "split" | "preview">("split");
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  
  const { register, handleSubmit, reset, watch, setValue, getValues, formState: { errors, isDirty } } = useForm({
    defaultValues: {
      title_en: "",
      title_ko: "",
      excerpt_en: "",
      excerpt_ko: "",
      content_en: "",
      content_ko: "",
      category: "Education",
      tags: "Education, Learning",
      author: session.user?.name || "Admin",
      date: new Date().toISOString().split('T')[0],
      image: undefined
    }
  });

  const formValues = watch();
  const markdownContent = generateMarkdown(formValues, imageUrl);

  // Load from localStorage on mount
  useEffect(() => {
    const savedForm = localStorage.getItem('editorFormData');
    if (savedForm) {
      try {
        const parsedForm = JSON.parse(savedForm);
        Object.entries(parsedForm).forEach(([key, value]) => {
          setValue(key as any, value);
        });
        setLastSaved(new Date());
      } catch (e) {
        console.error('Failed to load saved form data');
      }
    }
  }, [setValue]);

  // Auto-save to localStorage when form changes
  useEffect(() => {
    if (!autoSaveEnabled || !isDirty) return;
    
    const timeoutId = setTimeout(() => {
      localStorage.setItem('editorFormData', JSON.stringify(formValues));
      setLastSaved(new Date());
    }, 3000);
    
    return () => clearTimeout(timeoutId);
  }, [formValues, autoSaveEnabled, isDirty]);

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError("");
    setSuccessUrl("");
    try {
      // 1. Upload image
      let uploadedImageUrl = imageUrl;
      if (data.image && data.image[0]) {
        console.log("Image file found, preparing for upload:", {
          name: data.image[0].name,
          type: data.image[0].type,
          size: data.image[0].size + " bytes"
        });
        
        // Directly verify the File object
        const file = data.image[0] as File;
        if (!(file instanceof File)) {
          console.error("Not a valid File object!", typeof file);
          throw new Error("Image is not a valid File object");
        }
        
        const formData = new FormData();
        formData.append("image", file);
        console.log("FormData created with image");
        
        // Verify the FormData content
        console.log("FormData entries:");
        for (const [key, value] of formData.entries()) {
          console.log(`- ${key}: ${value instanceof File ? `File(${value.name}, ${value.type}, ${value.size} bytes)` : value}`);
        }
        
        try {
          console.log("Sending upload request to /api/upload...");
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          
          console.log("Upload response status:", uploadRes.status);
          if (!uploadRes.ok) {
            const errorText = await uploadRes.text();
            console.error("Upload failed:", errorText);
            throw new Error(`Image upload failed: ${uploadRes.status} ${errorText}`);
          }
          
          const uploadJson = await uploadRes.json();
          console.log("Upload successful, received URL:", uploadJson.url);
          uploadedImageUrl = uploadJson.url;
          setImageUrl(uploadedImageUrl);
        } catch (uploadError: any) {
          console.error("Upload request error:", uploadError);
          throw new Error("Image upload request failed: " + (uploadError.message || "Unknown error"));
        }
      } else {
        console.log("No image file to upload, using existing URL:", uploadedImageUrl);
      }
      // 2. Generate markdown
      const slug = slugify(data.title_en);
      const filePath = `src/content/blog/${slug}.md`;
      const tagsArr = data.tags.split(",").map((t: string) => t.trim()).filter(Boolean);
      const markdown = generateMarkdown(data, uploadedImageUrl);
      
      // Debug: Check if image URL is in the markdown
      console.log("Generated markdown with image URL:", uploadedImageUrl);
      const imageLineMatch = markdown.match(/image:\s*\n\s*src:\s*'([^']*)'/);
      console.log("Image URL in markdown:", imageLineMatch ? imageLineMatch[1] : "Not found");
      
      // 3. Commit to GitHub
      const commitRes = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown,
          path: filePath,
          message: `docs: add/update post '${data.title_en}'`,
        }),
      });
      if (!commitRes.ok) {
        const err = await commitRes.json();
        throw new Error(err.error || "GitHub commit failed");
      }
      const commitJson = await commitRes.json();
      setSuccessUrl(commitJson.commitUrl);
      reset();
      setImageUrl("");
      if (imageInputRef.current) imageInputRef.current.value = "";
      // Clear localStorage on successful submit
      localStorage.removeItem('editorFormData');
      setLastSaved(null);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Post Content</h2>
        <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded-md">
          <div className="flex items-center space-x-2">
            <input 
              type="checkbox"
              id="autosave"
              checked={autoSaveEnabled}
              onChange={() => setAutoSaveEnabled(!autoSaveEnabled)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="autosave" className="text-sm font-medium text-gray-700">
              Auto-save draft
            </label>
          </div>
          {lastSaved && autoSaveEnabled && (
            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-md border border-gray-100">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title_en" className="font-medium">Title (EN)</Label>
            <Input
              id="title_en"
              placeholder="English title..."
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              {...register("title_en", { required: true })}
            />
            {errors.title_en && <span className="text-red-500 text-sm">Required</span>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="excerpt_en" className="font-medium">Excerpt (EN)</Label>
            <Textarea
              id="excerpt_en"
              placeholder="English excerpt..."
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              {...register("excerpt_en", { required: true })}
            />
            {errors.excerpt_en && <span className="text-red-500 text-sm">Required</span>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="content_en" className="font-medium">Content (EN)</Label>
            <Textarea
              id="content_en"
              placeholder="English content... (No need to include title as it's generated automatically)"
              rows={8}
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              {...register("content_en", { required: true })}
            />
            {errors.content_en && <span className="text-red-500 text-sm">Required</span>}
            <p className="text-xs text-gray-500">Note: No need to include the title at the top of your content as it's automatically added from the title field.</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title_ko" className="font-medium">Title (KO)</Label>
            <Input
              id="title_ko"
              placeholder="Korean title..."
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              {...register("title_ko", { required: true })}
            />
            {errors.title_ko && <span className="text-red-500 text-sm">Required</span>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="excerpt_ko" className="font-medium">Excerpt (KO)</Label>
            <Textarea
              id="excerpt_ko"
              placeholder="Korean excerpt..."
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              {...register("excerpt_ko", { required: true })}
            />
            {errors.excerpt_ko && <span className="text-red-500 text-sm">Required</span>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="content_ko" className="font-medium">Content (KO)</Label>
            <Textarea
              id="content_ko"
              placeholder="Korean content... (No need to include title as it's generated automatically)"
              rows={8}
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              {...register("content_ko", { required: true })}
            />
            {errors.content_ko && <span className="text-red-500 text-sm">Required</span>}
            <p className="text-xs text-gray-500">Note: No need to include the title at the top of your content as it's automatically added from the title field.</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
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
        
        <div className="space-y-2">
          <Label htmlFor="tags" className="font-medium">Tags</Label>
          <Input
            id="tags"
            placeholder="comma, separated, tags"
            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            {...register("tags", { required: true })}
          />
          {errors.tags && <span className="text-red-500 text-sm">Required</span>}
        </div>
        
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
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="date" className="font-medium">Date</Label>
          <Input
            id="date"
            type="date"
            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            {...register("date", { required: true })}
          />
          {errors.date && <span className="text-red-500 text-sm">Required</span>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="image" className="font-medium">Image</Label>
          <Input
            id="image"
            type="file"
            accept="image/*"
            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            {...register("image", { required: !imageUrl })}
            ref={imageInputRef}
            onChange={(e) => {
              // Log file selection details
              if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                console.log("File selected:", {
                  name: file.name,
                  type: file.type,
                  size: file.size + " bytes"
                });
              } else {
                console.log("No file selected");
              }
            }}
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
      </div>
      
      <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="w-full sm:w-auto">
          <Button
            type="submit"
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md shadow transition duration-200 flex items-center justify-center"
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Publishing...
              </>
            ) : (
              <>Publish Post</>
            )}
          </Button>
        </div>
        <div className="w-full sm:w-auto">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md border border-red-100 text-sm">
              {error}
            </div>
          )}
          {successUrl && (
            <div className="bg-green-50 text-green-700 p-3 rounded-md border border-green-100 text-sm">
              Success! <a href={successUrl} target="_blank" rel="noopener noreferrer" className="underline">View Commit</a>
            </div>
          )}
        </div>
      </div>
    </form>
  );

  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false);

  const renderPreview = () => (
    <div className="h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Preview</h2>
        <div className="flex space-x-2">
          <Button 
            variant={showRawMarkdown ? "default" : "outline"}
            size="sm"
            onClick={() => setShowRawMarkdown(!showRawMarkdown)}
            className={showRawMarkdown ? 
              "bg-blue-600 text-white hover:bg-blue-700" : 
              "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
            }
          >
            {showRawMarkdown ? "📄 View Rendered" : "📝 View Raw Markdown"}
          </Button>
          <div className="bg-gray-50 px-3 py-1 rounded-md text-sm text-gray-500 border border-gray-200">Markdown Preview</div>
        </div>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4 text-amber-700 text-sm">
        <strong>Note:</strong> The title is automatically added from the title field. Don't include an H1 heading at the beginning of your content to avoid title duplication.
      </div>
      <div className="border rounded-md p-6 bg-white shadow-sm overflow-auto h-[calc(100vh-14rem)]">
        {showRawMarkdown ? (
          <pre className="text-sm font-mono whitespace-pre-wrap overflow-x-auto bg-gray-50 p-4 rounded-md border border-gray-200">
            {markdownContent}
          </pre>
        ) : (
          <div className="prose prose-blue max-w-none">
            {/* Add image preview at the top of the rendered content */}
            {imageUrl && (
              <div className="mb-6 not-prose">
                <div className="border rounded-md overflow-hidden">
                  <img src={imageUrl} alt="Featured" className="w-full max-h-[300px] object-cover" />
                  <div className="p-2 bg-gray-50 border-t text-sm text-gray-500">Featured Image</div>
                </div>
              </div>
            )}
            <ReactMarkdown>{markdownContent}</ReactMarkdown>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-between">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setShowRawMarkdown(!showRawMarkdown)}
          className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
        >
          {showRawMarkdown ? "📄 View Rendered" : "📝 View Raw Markdown"}
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
          onClick={() => setRegenerateModalOpen(true)}
        >
          Regenerate Preview
        </Button>
      </div>
    </div>
  );

  // Generate bilingual content preview
  const generatePreview = async () => {
    setAiLoading(true);
    try {
      // First, try to upload the image if there is one and no imageUrl yet
      let previewImageUrl = imageUrl;
      
      if (!previewImageUrl && imageInputRef.current?.files?.length) {
        try {
          console.log("Found image file for preview, attempting upload");
          const formData = new FormData();
          formData.append("image", imageInputRef.current.files[0]);
          
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          
          if (!uploadRes.ok) {
            const errorText = await uploadRes.text();
            console.error("Image upload for preview failed:", errorText);
            // Continue without image if upload fails
          } else {
            const uploadJson = await uploadRes.json();
            console.log("Preview image uploaded successfully:", uploadJson.url);
            previewImageUrl = uploadJson.url;
            setImageUrl(previewImageUrl); // Save the URL for later use
          }
        } catch (uploadError: any) {
          console.error("Preview image upload error:", uploadError);
          // Continue preview generation even if image upload fails
        }
      }
      
      const formData = getValues();
      const response = await fetch("/api/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: formData.content_en || formData.content_ko,
          title: formData.title_en || formData.title_ko,
          author: formData.author,
          category: formData.category,
          tags: formData.tags,
          imageUrl: previewImageUrl // Use the uploaded image URL
        }),
      });
      if (!response.ok) throw new Error("Failed to regenerate preview");
      const data = await response.json();
      
      // Update form values with regenerated content
      setValue("title_en", data.parsed.titleEn);
      setValue("title_ko", data.parsed.titleKo);
      setValue("excerpt_en", data.parsed.excerptEn);
      setValue("excerpt_ko", data.parsed.excerptKo);
      setValue("content_en", data.parsed.contentEn);
      setValue("content_ko", data.parsed.contentKo);
      
      setRegenerateModalOpen(false);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-8 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Post</h1>
        <div className="text-sm text-gray-500">
          {session.user?.email && `Signed in as ${session.user.email}`}
        </div>
      </div>
      
      <AIContentGenerator setValue={setValue} loading={loading || aiLoading} setLoading={setAiLoading} />
      
      {/* Add the AI Chat Assistant for in-context help */}
      <AIChatAssistant 
        isLoading={loading || aiLoading}
        initialMessage="I'm your blog post assistant. I can help you with ideas, content structure, or any questions about creating bilingual blog posts. What would you like help with?"
      />
      
      {/* Regenerate Preview Modal */}
      <Dialog open={regenerateModalOpen} onOpenChange={setRegenerateModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Regenerate Preview</DialogTitle>
            <DialogDescription>
              This will use AI to regenerate the preview based on your current content.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRegenerateModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={generatePreview}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Regenerating...
                </>
              ) : (
                "Regenerate"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-0">
          <Tabs defaultValue="split" className="w-full" onValueChange={(value: string) => setPreviewMode(value as "edit" | "split" | "preview")}>
            <div className="border-b border-gray-200">
              <TabsList className="w-full bg-gray-50 p-0 rounded-none flex">
                <TabsTrigger 
                  value="edit"
                  className="flex-1 data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:shadow-none py-3 rounded-none"
                >
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Edit Mode
                  </span>
                </TabsTrigger>
                <TabsTrigger 
                  value="split" 
                  className="flex-1 data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:shadow-none py-3 rounded-none"
                >
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line></svg>
                    Split Mode
                  </span>
                </TabsTrigger>
                <TabsTrigger 
                  value="preview" 
                  className="flex-1 data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:shadow-none py-3 rounded-none"
                >
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    Preview Mode
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="edit" className="p-6 focus-visible:outline-none focus-visible:ring-0">
              {renderForm()}
            </TabsContent>
            
            <TabsContent value="split" className="p-0 focus-visible:outline-none focus-visible:ring-0">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="p-6 border-r border-gray-200">
                  {renderForm()}
                </div>
                <div className="p-6 bg-gray-50">
                  {renderPreview()}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="preview" className="p-6 focus-visible:outline-none focus-visible:ring-0">
              {renderPreview()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Raw Markdown Debug Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
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
            className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
            onClick={() => {
              // Copy to clipboard
              navigator.clipboard.writeText(markdownContent);
              setError("Markdown copied to clipboard!");
              setTimeout(() => setError(""), 3000);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy Markdown
          </Button>
        </div>
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <pre className="text-sm font-mono whitespace-pre-wrap overflow-x-auto bg-gray-50 p-4 rounded-md border border-gray-200 max-h-[500px] overflow-y-auto">
              {markdownContent}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

 