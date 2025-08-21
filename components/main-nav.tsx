"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface MainNavProps {
  isMobile?: boolean;
}

export function MainNav({ isMobile = false }: MainNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        isMobile
          ? "flex flex-col space-y-2"
          : "flex items-center space-x-4 lg:space-x-6"
      )}
    >
      <Link
        href="/"
        className={cn(
          "text-sm font-medium transition-colors hover:text-primary flex items-center",
          pathname === "/"
            ? "text-primary font-semibold"
            : "text-muted-foreground",
          isMobile && "py-2 px-3 rounded-md hover:bg-gray-50 w-full"
        )}
      >
        {isMobile && (
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
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        )}
        Home
      </Link>
      <Link
        href="/blog"
        className={cn(
          "text-sm font-medium transition-colors hover:text-primary flex items-center",
          pathname === "/blog"
            ? "text-primary font-semibold"
            : "text-muted-foreground",
          isMobile && "py-2 px-3 rounded-md hover:bg-gray-50 w-full"
        )}
      >
        {isMobile && (
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
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        )}
        Create Blog Post
      </Link>
      <Link
        href="/image-assets"
        className={cn(
          "text-sm font-medium transition-colors hover:text-primary flex items-center",
          pathname === "/image-assets"
            ? "text-primary font-semibold"
            : "text-muted-foreground",
          isMobile && "py-2 px-3 rounded-md hover:bg-gray-50 w-full"
        )}
      >
        {isMobile && (
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
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
            <circle cx="9" cy="9" r="2"></circle>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
          </svg>
        )}
        Image Assets
      </Link>
    </nav>
  );
}
