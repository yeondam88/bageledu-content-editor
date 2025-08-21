"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Image as ImageIcon,
  Download,
  Copy,
  Trash2,
  Eye,
  FileImage,
  Loader2,
  Search,
  Grid3x3,
  List,
  CheckCircle2,
  X,
  FolderOpen,
  Sparkles,
  Info,
} from "lucide-react";

interface OptimizedImage {
  name: string;
  url: string;
  size: number;
  width: number;
  height: number;
  format: string;
  quality: number;
}

interface UploadResult {
  original: {
    name: string;
    size: number;
    width: number;
    height: number;
    format: string;
  };
  optimized: OptimizedImage[];
}

interface ImageAsset {
  name: string;
  url: string;
  size: number;
  created: string;
  updated: string;
}

export default function ImageAssetsPage() {
  const { data: session, status } = useSession();
  const [uploadLoading, setUploadLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [existingAssets, setExistingAssets] = useState<ImageAsset[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter assets based on search query
  const filteredAssets = existingAssets.filter((asset) =>
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Load existing assets
  const loadExistingAssets = async () => {
    setListLoading(true);
    try {
      const response = await fetch("/api/image-assets");
      if (!response.ok) throw new Error("Failed to load assets");

      const data = await response.json();
      setExistingAssets(data.images || []);
    } catch (error) {
      toast.error(
        "Failed to load existing assets: " + (error as Error).message
      );
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.isAuthorized) {
      loadExistingAssets();
    }
  }, [session]);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Process selected file
  const processFile = (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size must be less than 20MB");
      return;
    }

    setSelectedFile(file);

    // Check if it's a PDF or other non-image file
    if (file.type === "application/pdf") {
      // Use a placeholder for PDFs
      setPreviewImage("PDF_PLACEHOLDER");
    } else {
      // For images, read and display the actual file
      const reader = new FileReader();
      reader.onload = (e) => setPreviewImage(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Handle drag events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  // Upload and optimize image
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select an image file");
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/image-assets", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await response.json();
      setUploadResults((prev) => [result, ...prev]);

      // Reset form
      setSelectedFile(null);
      setPreviewImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Reload existing assets
      loadExistingAssets();

      toast.success("Image uploaded and optimized successfully!");
    } catch (error) {
      toast.error("Upload failed: " + (error as Error).message);
    } finally {
      setUploadLoading(false);
    }
  };

  // Copy URL to clipboard
  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copied to clipboard!");
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  // Delete image
  const deleteImage = async (fileName: string) => {
    if (!confirm("Are you sure you want to delete this image?")) return;

    try {
      const response = await fetch("/api/image-assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Delete failed");
      }

      loadExistingAssets();
      toast.success("Image deleted successfully!");
    } catch (error) {
      toast.error("Delete failed: " + (error as Error).message);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <Card className="w-[450px] shadow-lg">
          <CardHeader className="text-center p-8">
            <div className="flex justify-center pb-6">
              <img
                src="https://www.bageledu.com/images/bageledu/BagelEducation6.png"
                alt="BagelEdu Logo"
                className="h-12"
              />
            </div>
            <CardTitle className="text-2xl mb-4">
              Image Assets Manager
            </CardTitle>
            <p className="text-gray-600 leading-relaxed">
              Upload and optimize images with automatic compression and format
              conversion
            </p>
          </CardHeader>
          <div className="flex justify-center px-8 pb-8">
            <Button
              onClick={() =>
                signIn("google", { callbackUrl: window.location.href })
              }
              className="w-full bg-black text-white hover:bg-gray-800"
              size="lg"
            >
              Sign in with Google
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!session.user?.isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <Card className="w-[450px] shadow-lg">
          <CardHeader className="text-center p-8">
            <CardTitle className="text-2xl mb-4">Access Denied</CardTitle>
            <p className="text-gray-600 leading-relaxed">
              You are not authorized to access the image assets manager.
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Toaster />

      <div className="max-w-7xl mx-auto px-8 py-16">
        {/* Header Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-semibold text-gray-900 mb-4">
              Image Assets
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed text-lg">
              Upload and optimize your images with automatic compression and
              format conversion
            </p>
          </div>
        </div>

        <Tabs defaultValue="upload" className="space-y-12">
          <div className="flex justify-center mb-12">
            <TabsList className="grid w-fit grid-cols-2 bg-gray-100 border-0 h-12 p-1.5 rounded-xl">
              <TabsTrigger
                value="upload"
                className="flex items-center gap-2 px-8 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm transition-all duration-200 text-sm font-medium text-gray-600"
              >
                <Upload className="h-4 w-4" />
                Upload
              </TabsTrigger>
              <TabsTrigger
                value="assets"
                className="flex items-center gap-2 px-8 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm transition-all duration-200 text-sm font-medium text-gray-600"
              >
                <ImageIcon className="h-4 w-4" />
                Library
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="upload" className="space-y-10">
            {/* Upload Section */}
            <Card className="border border-gray-200 shadow-sm bg-white">
              <CardHeader className="p-8 pb-6">
                <CardTitle className="text-xl font-medium text-gray-900 mb-3">
                  Upload & Optimize
                </CardTitle>
                <p className="text-gray-600 text-base leading-relaxed">
                  Upload images and get multiple optimized versions
                  automatically
                </p>
              </CardHeader>
              <CardContent className="p-8 pt-6 space-y-10">
                <div className="space-y-6">
                  <div
                    className={`relative transition-all duration-200 ${
                      isDragActive ? "scale-[1.02]" : ""
                    }`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <Input
                      id="image"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp, application/pdf"
                      onChange={handleFileSelect}
                      ref={fileInputRef}
                      className={`border-2 border-dashed ${
                        isDragActive
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-300 hover:border-gray-400 bg-gray-50/50"
                      } focus:border-gray-500 focus:ring-0 rounded-xl p-12 h-auto transition-all duration-200 cursor-pointer`}
                    />
                    {!selectedFile && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <div
                          className={`${isDragActive ? "animate-bounce" : ""}`}
                        >
                          <Upload
                            className={`h-8 w-8 mb-4 ${
                              isDragActive ? "text-blue-500" : "text-gray-400"
                            }`}
                          />
                        </div>
                        <p
                          className={`font-medium mb-2 ${
                            isDragActive ? "text-blue-600" : "text-gray-600"
                          }`}
                        >
                          {isDragActive
                            ? "Drop your image here"
                            : "Click to upload or drag and drop"}
                        </p>
                        <p className="text-sm text-gray-500">
                          JPEG, PNG, WebP • Max 20MB
                        </p>
                      </div>
                    )}
                  </div>

                  {/* File types info */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="bg-gray-50 rounded-xl p-5 flex items-center gap-3">
                      <FileImage className="h-5 w-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">JPEG</p>
                        <p className="text-gray-500 text-xs">Best for photos</p>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-5 flex items-center gap-3">
                      <FileImage className="h-5 w-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">PNG</p>
                        <p className="text-gray-500 text-xs">
                          Best for graphics
                        </p>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-5 flex items-center gap-3">
                      <FileImage className="h-5 w-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">WebP</p>
                        <p className="text-gray-500 text-xs">Best for web</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                {previewImage && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-gray-200 rounded-xl overflow-hidden bg-white"
                  >
                    <div className="bg-gray-50 px-8 py-6 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        <h3 className="font-medium text-gray-900">
                          {selectedFile?.type === "application/pdf"
                            ? "PDF ready for upload"
                            : "Image ready for optimization"}
                        </h3>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewImage(null);
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="p-8">
                      <div className="flex flex-col lg:flex-row gap-8">
                        <div className="flex-shrink-0">
                          <div className="relative group">
                            {previewImage === "PDF_PLACEHOLDER" ? (
                              <div className="w-80 h-80 border rounded-xl bg-white p-8 shadow-sm flex items-center justify-center">
                                <div className="text-center">
                                  <svg
                                    className="mx-auto h-24 w-24 text-red-500 mb-4"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                                    <text
                                      x="12"
                                      y="16"
                                      textAnchor="middle"
                                      className="text-xs font-bold fill-current"
                                    >
                                      PDF
                                    </text>
                                  </svg>
                                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    PDF Document
                                  </h3>
                                  <p className="text-sm text-gray-500">
                                    {selectedFile?.name}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <img
                                src={previewImage}
                                alt="Preview"
                                className="max-w-80 max-h-80 object-contain border rounded-xl bg-white p-4 shadow-sm"
                              />
                            )}
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-5 transition-opacity rounded-xl" />
                          </div>
                        </div>
                        <div className="flex-1 space-y-6">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-xl p-5">
                              <div className="flex items-center gap-2 mb-2">
                                <Info className="h-4 w-4 text-gray-500" />
                                <p className="text-xs text-gray-500 font-medium">
                                  File Name
                                </p>
                              </div>
                              <p className="text-sm font-medium truncate text-gray-900">
                                {selectedFile?.name}
                              </p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-5">
                              <div className="flex items-center gap-2 mb-2">
                                <Info className="h-4 w-4 text-gray-500" />
                                <p className="text-xs text-gray-500 font-medium">
                                  File Size
                                </p>
                              </div>
                              <p className="text-sm font-medium text-gray-900">
                                {formatFileSize(selectedFile?.size || 0)}
                              </p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-5">
                              <div className="flex items-center gap-2 mb-2">
                                <Info className="h-4 w-4 text-gray-500" />
                                <p className="text-xs text-gray-500 font-medium">
                                  File Type
                                </p>
                              </div>
                              <p className="text-sm font-medium text-gray-900">
                                {selectedFile?.type}
                              </p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-5">
                              <div className="flex items-center gap-2 mb-2">
                                <Info className="h-4 w-4 text-gray-500" />
                                <p className="text-xs text-gray-500 font-medium">
                                  Status
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                <p className="text-sm font-medium text-emerald-700">
                                  Ready to optimize
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Optimization preview */}
                          <div className="border border-gray-200 rounded-xl p-6 bg-blue-50/30">
                            <div className="flex items-start gap-3">
                              <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900 mb-1">
                                  What will happen after upload:
                                </p>
                                <ul className="text-xs text-gray-600 space-y-1">
                                  <li>
                                    • Create WebP version with 85% quality
                                  </li>
                                  <li>
                                    • Create JPEG version with 80% quality
                                  </li>
                                  <li>
                                    • Generate 4 size variants (thumbnail,
                                    small, medium, large)
                                  </li>
                                  <li>
                                    • Compress and optimize for web performance
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploadLoading}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed h-12"
                >
                  {uploadLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {selectedFile?.type === "application/pdf"
                        ? "Uploading..."
                        : "Processing..."}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      {selectedFile?.type === "application/pdf"
                        ? "Upload PDF"
                        : "Upload & Optimize"}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Upload Results */}
            <AnimatePresence>
              {uploadResults.map((result, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border border-gray-200 shadow-sm bg-white">
                    <CardHeader className="p-8 pb-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            <h3 className="text-lg font-medium text-gray-900">
                              Optimization Complete
                            </h3>
                          </div>
                          <p className="text-sm text-gray-600 mb-4 font-medium">
                            {result.original.name}
                          </p>
                          <div className="flex flex-wrap gap-3 text-xs">
                            <div className="bg-gray-50 rounded-md px-3 py-2 border border-gray-200">
                              <span className="text-gray-500">Original:</span>{" "}
                              <span className="font-medium">
                                {formatFileSize(result.original.size)}
                              </span>
                            </div>
                            <div className="bg-gray-50 rounded-md px-3 py-2 border border-gray-200">
                              <span className="text-gray-500">Dimensions:</span>{" "}
                              <span className="font-medium">
                                {result.original.width}×{result.original.height}
                              </span>
                            </div>
                            <div className="bg-gray-50 rounded-md px-3 py-2 border border-gray-200">
                              <span className="text-gray-500">Format:</span>{" "}
                              <span className="font-medium">
                                {result.original.format?.toUpperCase()}
                              </span>
                            </div>
                            <div className="bg-emerald-50 rounded-md px-3 py-2 border border-emerald-200">
                              <span className="text-emerald-700">
                                ✓ {result.optimized.length} variants created
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-6">
                          {result.original.format === "pdf" ? (
                            <div className="w-20 h-20 bg-gray-50 rounded-lg border border-gray-200 shadow-sm flex items-center justify-center">
                              <svg
                                className="h-8 w-8 text-red-500"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                              </svg>
                            </div>
                          ) : (
                            <img
                              src={result.optimized[0]?.url || ""}
                              alt="Optimized preview"
                              className="w-20 h-20 object-cover rounded-lg border border-gray-200 shadow-sm"
                            />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-8 pt-0">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {result.optimized.map((image, imgIndex) => (
                          <motion.div
                            key={imgIndex}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: imgIndex * 0.05 }}
                            className="bg-gray-50 rounded-xl p-6 space-y-5 border border-gray-200"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate mb-2 text-sm">
                                  {image.name}
                                </h4>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <span>{formatFileSize(image.size)}</span>
                                    <span>•</span>
                                    <span>
                                      {image.width}×{image.height}
                                    </span>
                                  </div>
                                  <div className="flex gap-2">
                                    <Badge
                                      variant="secondary"
                                      className="text-xs bg-white border border-gray-300"
                                    >
                                      {image.format.toUpperCase()}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="text-xs bg-white"
                                    >
                                      Q{image.quality}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="ml-4 flex-shrink-0">
                                <img
                                  src={image.url}
                                  alt={image.name}
                                  className="w-16 h-16 object-cover rounded border border-gray-300 bg-white"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(image.url)}
                                className="flex-1 bg-white hover:bg-gray-100 text-xs h-8"
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy URL
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(image.url, "_blank")}
                                className="bg-white hover:bg-gray-100 h-8"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="assets" className="space-y-10 p-4">
            {/* Asset Library */}
            <Card className="border border-gray-200 shadow-sm bg-white p-4">
              <CardHeader className="p-8 pb-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-medium text-gray-900 mb-3">
                      Asset Library
                    </CardTitle>
                    <p className="text-gray-600 text-base leading-relaxed">
                      Browse and manage your uploaded image assets
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search assets..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-3 h-9 w-60 text-sm border-gray-300"
                      />
                      {searchQuery && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    {/* View Mode */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                      <Button
                        size="sm"
                        variant={viewMode === "grid" ? "default" : "ghost"}
                        onClick={() => setViewMode("grid")}
                        className="h-7 w-7 p-0"
                      >
                        <Grid3x3 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={viewMode === "list" ? "default" : "ghost"}
                        onClick={() => setViewMode("list")}
                        className="h-7 w-7 p-0"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>

                    <Button
                      onClick={loadExistingAssets}
                      variant="outline"
                      disabled={listLoading}
                      className="bg-white hover:bg-gray-50 border-gray-300 h-9 text-sm"
                    >
                      {listLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* Stats bar */}
                {existingAssets.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-200 flex items-center gap-8 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-gray-600">
                        {filteredAssets.length} assets found
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-gray-600">
                        {formatFileSize(
                          existingAssets.reduce(
                            (acc, asset) => acc + asset.size,
                            0
                          )
                        )}{" "}
                        total
                      </span>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-8 pt-0">
                {filteredAssets.length === 0 ? (
                  <div className="text-center py-24">
                    {existingAssets.length === 0 ? (
                      <>
                        <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FolderOpen className="h-10 w-10 text-gray-400" />
                        </div>
                        <h3 className="text-base font-medium text-gray-900 mb-2">
                          No assets yet
                        </h3>
                        <p className="text-gray-500 text-sm mb-6">
                          Upload some images to get started with your library
                        </p>
                        <Button
                          onClick={() => {
                            const input = document.querySelector(
                              'input[type="file"]'
                            ) as HTMLInputElement;
                            input?.click();
                          }}
                          className="bg-gray-900 hover:bg-gray-800 text-white text-sm h-9"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Image
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Search className="h-10 w-10 text-gray-400" />
                        </div>
                        <h3 className="text-base font-medium text-gray-900 mb-2">
                          No results found
                        </h3>
                        <p className="text-gray-500 text-sm">
                          Try adjusting your search terms
                        </p>
                      </>
                    )}
                  </div>
                ) : viewMode === "grid" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredAssets.map((asset, index) => (
                      <motion.div
                        key={asset.name}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="group bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-gray-300 transition-colors duration-200"
                      >
                        <div className="aspect-square bg-gray-50 relative overflow-hidden">
                          {asset.name.toLowerCase().endsWith(".pdf") ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="text-center">
                                <svg
                                  className="mx-auto h-16 w-16 text-red-500 mb-2"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                                </svg>
                                <p className="text-xs text-gray-600 font-medium">
                                  PDF
                                </p>
                              </div>
                            </div>
                          ) : (
                            <img
                              src={asset.url}
                              alt={asset.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>
                        <div className="p-5 space-y-4">
                          <div>
                            <h3 className="font-medium truncate text-gray-900 text-sm mb-1">
                              {asset.name}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{formatFileSize(asset.size)}</span>
                              <span>•</span>
                              <span>
                                {new Date(asset.created).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(asset.url)}
                              className="flex-1 bg-gray-50 hover:bg-gray-100 border-gray-200 text-xs h-8"
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(asset.url, "_blank")}
                              className="bg-gray-50 hover:bg-gray-100 border-gray-200 h-8"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteImage(asset.name)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-gray-200 h-8"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  /* List View */
                  <div className="space-y-3">
                    {filteredAssets.map((asset, index) => (
                      <motion.div
                        key={asset.name}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="group bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors duration-200 p-6"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0">
                            <img
                              src={asset.url}
                              alt={asset.name}
                              className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                              loading="lazy"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate text-gray-900 text-sm mb-1">
                              {asset.name}
                            </h3>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{formatFileSize(asset.size)}</span>
                              <span>•</span>
                              <span>
                                {new Date(asset.created).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(asset.url)}
                              className="bg-gray-50 hover:bg-gray-100 border-gray-200 text-xs h-9 px-3"
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy URL
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(asset.url, "_blank")}
                              className="bg-gray-50 hover:bg-gray-100 border-gray-200 h-8"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteImage(asset.name)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-gray-200 h-8"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
