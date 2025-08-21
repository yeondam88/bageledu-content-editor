"use client";
import { useSession, signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
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
  if (!data) return "";
  const tagsArr = (data.tags || "")
    .split(",")
    .map((t: string) => t.trim())
    .filter(Boolean);

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
    if (formattedImageUrl.includes("digitaloceanspaces.com")) {
      const urlParts = formattedImageUrl.split("/");
      const domainPart = urlParts[2]; // e.g., "bucket.region.digitaloceanspaces.com"

      // Check if the URL is missing region
      if (!domainPart.match(/[^.]+\.[^.]+\.digitaloceanspaces\.com/)) {
        // Extract bucket name
        const bucketName = domainPart.split(".")[0];
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
${contentEn ? contentEn : ""}
</div>

{/* Korean Content */}

<div class="ko-content" x-show="$store.language === 'ko'">
${contentKo ? contentKo : ""}
</div>
`;
}

function AiGenerateButton({
  language,
  type,
  setValue,
  loading,
  setLoading,
}: {
  language: "en" | "ko";
  type: "title" | "excerpt" | "content" | "all";
  setValue: any;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [previewContent, setPreviewContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const handleGenerate = async () => {
    if (!prompt) {
      setError("Please enter a prompt");
      return;
    }

    setGenerating(true);
    setError("");
    setShowPreview(false);

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

      // Set preview content for review
      setPreviewContent(data.content);
      setShowPreview(true);
      setGenerating(false);
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setGenerating(false);
    }
  };

  const applyContent = () => {
    // Update form field based on type and language
    if (type === "title") {
      setValue(`title_${language}`, previewContent);
    } else if (type === "excerpt") {
      setValue(`excerpt_${language}`, previewContent);
    } else if (type === "content") {
      // For content-only generation, make sure we're not including titles in the content
      let content = previewContent;

      // Remove any heading that might be at the beginning of the content
      // This prevents title duplication since titles are handled separately
      const lines = content.split("\n");
      const titleIndex = lines.findIndex(
        (line: string) => line.startsWith("# ") || line.startsWith("## ")
      );

      if (titleIndex === 0) {
        // Only remove if it's the first line
        content = lines.slice(1).join("\n").trim();
      }

      setValue(`content_${language}`, content);
    } else if (type === "all") {
      // Parse the AI response - this is simplified and might need adjustment
      const lines = previewContent.split("\n");
      let title = "";
      let excerpt = "";
      let content = "";

      // Extract title (usually first line or line with # or ##)
      const titleIndex = lines.findIndex(
        (line: string) => line.startsWith("# ") || line.startsWith("## ")
      );
      if (titleIndex >= 0) {
        title = lines[titleIndex].replace(/^#+ /, "");
      } else if (lines.length > 0) {
        title = lines[0];
      }

      // Try to find excerpt (usually shorter paragraph after title)
      for (let i = titleIndex + 1; i < lines.length; i++) {
        if (lines[i].trim() && !lines[i].startsWith("#")) {
          excerpt = lines[i];
          break;
        }
      }

      // The rest is content
      content = lines.slice(Math.max(titleIndex + 1, 1)).join("\n");

      setValue(`title_${language}`, title);
      setValue(`excerpt_${language}`, excerpt);
      setValue(`content_${language}`, content);
    }

    setDialogOpen(false);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={`text-sm flex-1 ${
            language === "en"
              ? "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"
              : "bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100"
          }`}
          disabled={loading}
          data-dialog={`${language}-${type}`}
        >
          {type === "all"
            ? "Complete"
            : type.charAt(0).toUpperCase() + type.slice(1)}{" "}
          {language === "en" ? "🇺🇸" : "🇰🇷"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-w-[calc(100%-2rem)] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Generate{" "}
            {type === "title"
              ? "Title"
              : type === "excerpt"
              ? "Excerpt"
              : type === "content"
              ? "Content"
              : "Complete Post"}
            &nbsp;in {language === "en" ? "English 🇺🇸" : "Korean 🇰🇷"}
          </DialogTitle>
          <DialogDescription>
            Enter a prompt describing what you want to generate.
          </DialogDescription>
        </DialogHeader>

        {!showPreview ? (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="prompt" className="text-right">
                Prompt
              </Label>
              <Textarea
                id="prompt"
                placeholder={`e.g. Write a ${
                  type === "title"
                    ? "title"
                    : type === "excerpt"
                    ? "brief excerpt"
                    : "detailed content"
                } about college application tips`}
                className="col-span-3"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
        ) : (
          <div className="mt-4 border rounded-md p-4 bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">Preview</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(false)}
              >
                Edit Prompt
              </Button>
            </div>
            <div className="prose prose-sm mt-2 max-h-[300px] overflow-y-auto p-3 bg-white border rounded-md">
              <pre className="whitespace-pre-wrap font-sans">
                {previewContent}
              </pre>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-4">
          {!showPreview ? (
            <Button
              onClick={handleGenerate}
              disabled={generating || !prompt}
              className="w-full sm:w-auto"
            >
              {generating ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Generating...
                </>
              ) : (
                "Preview Generated Content"
              )}
            </Button>
          ) : (
            <Button
              onClick={applyContent}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
            >
              Apply to Form
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AIContentGenerator({
  setValue,
  loading,
  setLoading,
}: {
  setValue: any;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState({
    title_en: "",
    excerpt_en: "",
    content_en: "",
    title_ko: "",
    excerpt_ko: "",
    content_ko: "",
  });

  const handleGenerate = async (prompt: string) => {
    if (!prompt) return;

    setGenerating(true);

    try {
      // Generate English content first
      const enResponse = await fetch("/api/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          language: "English",
          type: "all",
        }),
      });

      if (!enResponse.ok) throw new Error("Failed to generate English content");

      const enData = await enResponse.json();
      const enContent = parseGeneratedContent(enData.content);

      // Then generate Korean content
      const koResponse = await fetch("/api/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Please translate the following content to Korean. Keep the same structure but adapt as needed for Korean readers:
          
Title: ${enContent.title}
Excerpt: ${enContent.excerpt}
Content: ${enContent.content}`,
          language: "Korean",
          type: "all",
        }),
      });

      if (!koResponse.ok) throw new Error("Failed to generate Korean content");

      const koData = await koResponse.json();
      const koContent = parseGeneratedContent(koData.content);

      setGeneratedContent({
        title_en: enContent.title,
        excerpt_en: enContent.excerpt,
        content_en: enContent.content,
        title_ko: koContent.title,
        excerpt_ko: koContent.excerpt,
        content_ko: koContent.content,
      });
    } catch (error) {
      console.error("Error generating content:", error);
    } finally {
      setGenerating(false);
    }
  };

  const parseGeneratedContent = (rawContent: string) => {
    const lines = rawContent.split("\n");

    // Extract title, excerpt, and content
    let title = "";
    let excerpt = "";
    let content = "";

    // Look for title markers
    const titleIndex = lines.findIndex(
      (line) =>
        line.startsWith("# ") ||
        line.startsWith("## ") ||
        line.toLowerCase().startsWith("title:")
    );

    if (titleIndex >= 0) {
      title = lines[titleIndex]
        .replace(/^#+ /, "")
        .replace(/^title:/i, "")
        .trim();

      // Look for excerpt
      for (let i = titleIndex + 1; i < lines.length; i++) {
        if (lines[i].trim() && !lines[i].startsWith("#")) {
          if (lines[i].toLowerCase().startsWith("excerpt:")) {
            excerpt = lines[i].replace(/^excerpt:/i, "").trim();
          } else {
            excerpt = lines[i].trim();
            break;
          }
        }
      }

      // Rest is content
      content = lines
        .slice(Math.max(titleIndex + 1, 1))
        .join("\n")
        .trim();

      // Remove excerpt from content if it's there
      if (excerpt && content.startsWith(excerpt)) {
        content = content.substring(excerpt.length).trim();
      }
    } else {
      // Fallback if no title marker found
      if (lines.length > 0) title = lines[0].trim();
      if (lines.length > 1) excerpt = lines[1].trim();
      content = lines.slice(2).join("\n").trim();
    }

    return { title, excerpt, content };
  };

  const applyGeneratedContent = () => {
    setValue("title_en", generatedContent.title_en);
    setValue("excerpt_en", generatedContent.excerpt_en);
    setValue("content_en", generatedContent.content_en);
    setValue("title_ko", generatedContent.title_ko);
    setValue("excerpt_ko", generatedContent.excerpt_ko);
    setValue("content_ko", generatedContent.content_ko);
    setDialogOpen(false);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button
          onClick={() => setDialogOpen(true)}
          className="w-full md:w-auto mb-4"
          size="lg"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2"
          >
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2"></path>
            <path d="M12 6v4"></path>
            <path d="M12 14h.01"></path>
          </svg>
          AI Content Generator
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Content with AI</DialogTitle>
          <DialogDescription>
            Describe what you want to write about and the AI will generate
            content in both English and Korean.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <AIChatAssistant
            onSend={handleGenerate}
            loading={generating}
            placeholder="Describe what you want to write about..."
            compact={true}
          />

          {generating && (
            <div className="text-center p-4">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
              <p className="mt-2 text-sm text-muted-foreground">
                Generating content in both languages...
              </p>
            </div>
          )}

          {(generatedContent.title_en || generatedContent.content_en) &&
            !generating && (
              <div className="space-y-4 mt-4 border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium mb-2">English Preview</h3>
                    <div className="border rounded-md p-3 bg-gray-50 space-y-2 h-[200px] overflow-y-auto">
                      <p className="font-semibold">
                        {generatedContent.title_en}
                      </p>
                      <p className="text-sm text-gray-600 italic">
                        {generatedContent.excerpt_en}
                      </p>
                      <div className="text-sm border-t pt-2">
                        {generatedContent.content_en
                          .split("\n")
                          .map((line, i) => (
                            <p key={i} className="mb-1">
                              {line}
                            </p>
                          ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Korean Preview</h3>
                    <div className="border rounded-md p-3 bg-gray-50 space-y-2 h-[200px] overflow-y-auto">
                      <p className="font-semibold">
                        {generatedContent.title_ko}
                      </p>
                      <p className="text-sm text-gray-600 italic">
                        {generatedContent.excerpt_ko}
                      </p>
                      <div className="text-sm border-t pt-2">
                        {generatedContent.content_ko
                          .split("\n")
                          .map((line, i) => (
                            <p key={i} className="mb-1">
                              {line}
                            </p>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={applyGeneratedContent}
                  className="w-full"
                  disabled={generating}
                >
                  Apply Generated Content
                </Button>
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EditorPage() {
  const { data: session } = useSession({ required: true });
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");
  const [successUrl, setSuccessUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [previewMode, setPreviewMode] = useState<"edit" | "split" | "preview">(
    "split"
  );
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false);
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize form with default values
  const defaultValues = {
    title_en: "",
    title_ko: "",
    excerpt_en: "",
    excerpt_ko: "",
    content_en: "",
    content_ko: "",
    category: "Education",
    tags: "Education, Learning",
    author: session?.user?.name || "Admin",
    date: new Date().toISOString().split("T")[0],
    image: undefined,
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues,
  });

  const formValues = watch();
  const markdownContent = generateMarkdown(formValues, imageUrl);

  // Load from localStorage on mount
  useEffect(() => {
    if (!session) return; // Don't load saved data if not logged in

    const savedForm = localStorage.getItem("editorFormData");
    if (savedForm) {
      try {
        const parsedForm = JSON.parse(savedForm);
        Object.entries(parsedForm).forEach(([key, value]) => {
          setValue(key as any, value);
        });
        setLastSaved(new Date());
      } catch (e) {
        console.error("Failed to load saved form data");
      }
    }
  }, [setValue, session]);

  // Auto-save to localStorage when form changes
  useEffect(() => {
    if (!session || !autoSaveEnabled || !isDirty) return;

    const timeoutId = setTimeout(() => {
      localStorage.setItem("editorFormData", JSON.stringify(formValues));
      setLastSaved(new Date());
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [formValues, autoSaveEnabled, isDirty, session]);

  // Redirect to sign in if no session exists
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Sign in required</h1>
        <p className="text-gray-600 mb-4">
          Please sign in to access the content editor.
        </p>
        <Button onClick={() => signIn()}>Sign in</Button>
      </div>
    );
  }

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError("");
    setSuccessUrl("");
    try {
      // 1. Upload image
      let uploadedImageUrl = imageUrl;
      if (data.image && data.image[0]) {
        // Directly verify the File object
        const file = data.image[0] as File;
        if (!(file instanceof File)) {
          throw new Error("Image is not a valid File object");
        }

        const formData = new FormData();
        formData.append("image", file);

        try {
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!uploadRes.ok) {
            const errorText = await uploadRes.text();
            throw new Error(
              `Image upload failed: ${uploadRes.status} ${errorText}`
            );
          }

          const uploadJson = await uploadRes.json();
          uploadedImageUrl = uploadJson.url;
          setImageUrl(uploadedImageUrl);
        } catch (uploadError: any) {
          throw new Error(
            "Image upload request failed: " +
              (uploadError.message || "Unknown error")
          );
        }
      }

      // 2. Generate markdown
      const slug = slugify(data.title_en);
      const filePath = `src/content/blog/${slug}.md`;
      const tagsArr = data.tags
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean);
      const markdown = generateMarkdown(data, uploadedImageUrl);

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
      localStorage.removeItem("editorFormData");
      setLastSaved(null);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => (
    <form className="space-y-6 px-2 sm:px-0" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h2 className="text-xl font-bold">Post Content</h2>
        <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded-md w-full sm:w-auto">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autosave"
              checked={autoSaveEnabled}
              onChange={() => setAutoSaveEnabled(!autoSaveEnabled)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor="autosave"
              className="text-sm font-medium text-gray-700"
            >
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title_en" className="font-medium">
              Title (EN)
            </Label>
            <Input
              id="title_en"
              placeholder="English title..."
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              {...register("title_en", { required: true })}
            />
            {errors.title_en && (
              <span className="text-red-500 text-sm">Required</span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt_en" className="font-medium">
              Excerpt (EN)
            </Label>
            <Textarea
              id="excerpt_en"
              placeholder="English excerpt..."
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              {...register("excerpt_en", { required: true })}
            />
            {errors.excerpt_en && (
              <span className="text-red-500 text-sm">Required</span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content_en" className="font-medium">
              Content (EN)
            </Label>
            <Textarea
              id="content_en"
              placeholder="English content... (No need to include title as it's generated automatically)"
              rows={8}
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              {...register("content_en", { required: true })}
            />
            {errors.content_en && (
              <span className="text-red-500 text-sm">Required</span>
            )}
            <p className="text-xs text-gray-500">
              Note: No need to include the title at the top of your content as
              it's automatically added from the title field.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title_ko" className="font-medium">
              Title (KO)
            </Label>
            <Input
              id="title_ko"
              placeholder="Korean title..."
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              {...register("title_ko", { required: true })}
            />
            {errors.title_ko && (
              <span className="text-red-500 text-sm">Required</span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt_ko" className="font-medium">
              Excerpt (KO)
            </Label>
            <Textarea
              id="excerpt_ko"
              placeholder="Korean excerpt..."
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              {...register("excerpt_ko", { required: true })}
            />
            {errors.excerpt_ko && (
              <span className="text-red-500 text-sm">Required</span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content_ko" className="font-medium">
              Content (KO)
            </Label>
            <Textarea
              id="content_ko"
              placeholder="Korean content... (No need to include title as it's generated automatically)"
              rows={8}
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              {...register("content_ko", { required: true })}
            />
            {errors.content_ko && (
              <span className="text-red-500 text-sm">Required</span>
            )}
            <p className="text-xs text-gray-500">
              Note: No need to include the title at the top of your content as
              it's automatically added from the title field.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label htmlFor="category" className="font-medium">
            Category
          </Label>
          <Input
            id="category"
            placeholder="e.g. College Planning"
            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            {...register("category", { required: true })}
          />
          {errors.category && (
            <span className="text-red-500 text-sm">Required</span>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags" className="font-medium">
            Tags
          </Label>
          <Input
            id="tags"
            placeholder="comma, separated, tags"
            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            {...register("tags", { required: true })}
          />
          {errors.tags && (
            <span className="text-red-500 text-sm">Required</span>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="author" className="font-medium">
            Author
          </Label>
          <Input
            id="author"
            placeholder="Author name"
            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            {...register("author", { required: true })}
          />
          {errors.author && (
            <span className="text-red-500 text-sm">Required</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="date" className="font-medium">
            Date
          </Label>
          <Input
            id="date"
            type="date"
            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            {...register("date", { required: true })}
          />
          {errors.date && (
            <span className="text-red-500 text-sm">Required</span>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="image" className="font-medium">
            Image
          </Label>
          <Input
            id="image"
            type="file"
            accept="image/*"
            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 max-w-full"
            {...register("image", { required: !imageUrl })}
            ref={imageInputRef}
            onChange={(e) => {
              // File selection handled
            }}
          />
          {errors.image && (
            <span className="text-red-500 text-sm">Required</span>
          )}
          {imageUrl && (
            <div className="mt-2 relative rounded-md overflow-hidden border border-gray-200">
              <img
                src={imageUrl}
                alt="Uploaded"
                className="max-h-40 w-full object-cover"
              />
              <div className="absolute top-2 right-2">
                <Badge className="bg-white text-gray-800 hover:bg-gray-100 shadow-sm">
                  Uploaded
                </Badge>
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
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
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
              Success!{" "}
              <a
                href={successUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View Commit
              </a>
            </div>
          )}
        </div>
      </div>
    </form>
  );

  const renderPreview = () => (
    <div className="h-full px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-0">
        <h2 className="text-xl font-bold">Preview</h2>
        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
          <Button
            variant={showRawMarkdown ? "default" : "outline"}
            size="sm"
            onClick={() => setShowRawMarkdown(!showRawMarkdown)}
            className={
              showRawMarkdown
                ? "bg-blue-600 text-white hover:bg-blue-700 flex-1 sm:flex-none"
                : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 flex-1 sm:flex-none"
            }
          >
            {showRawMarkdown ? "📄 View Rendered" : "📝 View Raw Markdown"}
          </Button>
          <div className="bg-gray-50 px-3 py-1 rounded-md text-sm text-gray-500 border border-gray-200 flex-1 sm:flex-none text-center sm:text-left">
            Markdown Preview
          </div>
        </div>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4 text-amber-700 text-sm">
        <strong>Note:</strong> The title is automatically added from the title
        field. Don't include an H1 heading at the beginning of your content to
        avoid title duplication.
      </div>
      <div className="border rounded-md p-4 sm:p-6 bg-white shadow-sm overflow-auto h-[calc(100vh-14rem)] max-h-[600px]">
        {showRawMarkdown ? (
          <pre className="text-sm font-mono whitespace-pre-wrap overflow-x-auto bg-gray-50 p-4 rounded-md border border-gray-200 text-xs sm:text-sm">
            {markdownContent}
          </pre>
        ) : (
          <div className="prose prose-blue max-w-none prose-sm sm:prose">
            {/* Add image preview at the top of the rendered content */}
            {imageUrl && (
              <div className="mb-6 not-prose">
                <div className="border rounded-md overflow-hidden">
                  <img
                    src={imageUrl}
                    alt="Featured"
                    className="w-full max-h-[300px] object-cover"
                  />
                  <div className="p-2 bg-gray-50 border-t text-sm text-gray-500">
                    Featured Image
                  </div>
                </div>
              </div>
            )}
            <ReactMarkdown>{markdownContent}</ReactMarkdown>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-col sm:flex-row justify-between gap-2 sm:gap-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRawMarkdown(!showRawMarkdown)}
          className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 w-full sm:w-auto"
        >
          {showRawMarkdown ? "📄 View Rendered" : "📝 View Raw Markdown"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-green-50 text-green-600 border-green-200 hover:bg-green-100 w-full sm:w-auto"
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
          const formData = new FormData();
          formData.append("image", imageInputRef.current.files[0]);

          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!uploadRes.ok) {
            // Continue without image if upload fails
          } else {
            const uploadJson = await uploadRes.json();
            previewImageUrl = uploadJson.url;
            setImageUrl(previewImageUrl); // Save the URL for later use
          }
        } catch (uploadError: any) {
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
          imageUrl: previewImageUrl, // Use the uploaded image URL
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
    <div className="container mx-auto py-6 sm:py-10 px-4 sm:px-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-8 gap-2 sm:gap-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Create New Post
        </h1>
        <div className="text-sm text-gray-500">
          {session.user?.email && `Signed in as ${session.user.email}`}
        </div>
      </div>

      <AIContentGenerator
        setValue={setValue}
        loading={loading || aiLoading}
        setLoading={setAiLoading}
      />

      {/* Add the AI Chat Assistant for in-context help */}
      <AIChatAssistant
        isLoading={loading || aiLoading}
        initialMessage="I'm your blog post assistant. I can help you with ideas, content structure, or any questions about creating bilingual blog posts. What would you like help with?"
      />

      {/* Regenerate Preview Modal */}
      <Dialog open={regenerateModalOpen} onOpenChange={setRegenerateModalOpen}>
        <DialogContent className="sm:max-w-[425px] max-w-[calc(100%-2rem)] mx-auto">
          <DialogHeader>
            <DialogTitle>Regenerate Preview</DialogTitle>
            <DialogDescription>
              This will use AI to regenerate the preview based on your current
              content.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRegenerateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={generatePreview} disabled={aiLoading}>
              {aiLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
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
          <Tabs
            defaultValue="split"
            className="w-full"
            onValueChange={(value: string) =>
              setPreviewMode(value as "edit" | "split" | "preview")
            }
          >
            <div className="mb-4 px-4 pt-4">
              <TabsList>
                <TabsTrigger value="edit" className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Edit Mode
                </TabsTrigger>
                <TabsTrigger value="split" className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect
                      x="3"
                      y="3"
                      width="18"
                      height="18"
                      rx="2"
                      ry="2"
                    ></rect>
                    <line x1="12" y1="3" x2="12" y2="21"></line>
                  </svg>
                  Split Mode
                </TabsTrigger>
                <TabsTrigger
                  value="preview"
                  className="flex items-center gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  Preview Mode
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="edit"
              className="p-6 focus-visible:outline-none focus-visible:ring-0"
            >
              {renderForm()}
            </TabsContent>

            <TabsContent
              value="split"
              className="p-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="p-6 border-r border-gray-200">
                  {renderForm()}
                </div>
                <div className="p-6 bg-gray-50">{renderPreview()}</div>
              </div>
            </TabsContent>

            <TabsContent
              value="preview"
              className="p-6 focus-visible:outline-none focus-visible:ring-0"
            >
              {renderPreview()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Raw Markdown Debug Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
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
