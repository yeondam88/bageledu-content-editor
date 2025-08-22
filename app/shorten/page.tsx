"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Link,
  Copy,
  ExternalLink,
  BarChart3,
  Calendar,
  Globe,
  Scissors,
  Plus,
  Loader2,
  Eye,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ShortenedUrl {
  id: string;
  originalUrl: string;
  shortCode: string;
  shortUrl: string;
  title: string;
  clicks: number;
  createdAt: string;
  expiresAt?: string;
  isActive: boolean;
  customCode: boolean;
}

export default function UrlShortener() {
  const { data: session, status } = useSession({ required: true });
  const [urls, setUrls] = useState<ShortenedUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Form state
  const [originalUrl, setOriginalUrl] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [title, setTitle] = useState("");
  const [expiresIn, setExpiresIn] = useState<number | "">("");

  // Load URLs on mount
  useEffect(() => {
    if (session) {
      fetchUrls();
    }
  }, [session]);

  const fetchUrls = async () => {
    try {
      setFetching(true);
      const response = await fetch("/api/shorten");
      if (!response.ok) throw new Error("Failed to fetch URLs");

      const data = await response.json();
      setUrls(data.urls || []);
    } catch (error) {
      toast.error("Failed to load URLs");
    } finally {
      setFetching(false);
    }
  };

  const shortenUrl = async () => {
    if (!originalUrl) {
      toast.error("Please enter a URL");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalUrl,
          customCode: customCode || undefined,
          title: title || undefined,
          expiresIn: expiresIn || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to shorten URL");
      }

      // Add to the list
      setUrls([data, ...urls]);

      // Clear form
      setOriginalUrl("");
      setCustomCode("");
      setTitle("");
      setExpiresIn("");

      toast.success("URL shortened successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to shorten URL");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => signIn("google")} className="w-full">
              Sign in with Google
            </Button>
          </CardContent>
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
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Scissors className="h-8 w-8 text-blue-600" />
              </div>
              <h1 className="text-4xl font-semibold text-gray-900">
                URL Shortener
              </h1>
            </div>
            <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed text-lg">
              Create short, memorable links for your long URLs with analytics
              and custom branding
            </p>
          </div>
        </div>

        {/* Shorten Form */}
        <Card className="mb-12 border border-gray-200 shadow-sm">
          <CardHeader className="p-8 pb-6">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Plus className="h-5 w-5" />
              Create Short URL
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-6 space-y-6">
            <div>
              <Label htmlFor="url">Original URL *</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/very/long/url"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="custom">Custom Code (optional)</Label>
                <Input
                  id="custom"
                  placeholder="my-link"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  3-10 characters, letters, numbers, _, -
                </p>
              </div>
              <div>
                <Label htmlFor="expires">Expires in (days)</Label>
                <Input
                  id="expires"
                  type="number"
                  placeholder="30"
                  value={expiresIn}
                  onChange={(e) =>
                    setExpiresIn(e.target.value ? parseInt(e.target.value) : "")
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                placeholder="My awesome link"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
              />
            </div>

            <Button
              onClick={shortenUrl}
              disabled={loading || !originalUrl}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Shortening...
                </>
              ) : (
                <>
                  <Scissors className="h-4 w-4 mr-2" />
                  Shorten URL
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* URLs List */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="p-8 pb-6">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Link className="h-5 w-5" />
              Your Short URLs ({urls.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            {fetching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : urls.length === 0 ? (
              <div className="text-center py-16">
                <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Globe className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No short URLs yet
                </h3>
                <p className="text-gray-500">
                  Create your first short URL using the form above
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <AnimatePresence>
                  {urls.map((url) => (
                    <motion.div
                      key={url.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="border border-gray-200 rounded-xl p-6 hover:bg-gray-50 transition-colors bg-white shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium text-gray-900 truncate">
                              {url.title || "Untitled"}
                            </h3>
                            {url.customCode && (
                              <Badge variant="secondary" className="text-xs">
                                Custom
                              </Badge>
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-blue-600">
                                {url.shortUrl}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(url.shortUrl)}
                                className="h-6 w-6 p-0"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  window.open(url.shortUrl, "_blank")
                                }
                                className="h-6 w-6 p-0"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>

                            <p className="text-sm text-gray-500 truncate">
                              {url.originalUrl}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 ml-4">
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Eye className="h-3 w-3" />
                              {url.clicks}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              {formatDate(url.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
