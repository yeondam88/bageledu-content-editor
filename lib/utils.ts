import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

export function slugify(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "-");
}

export function imageUrlValidation(url: string): boolean {
  if (!url) return false;
  
  // Basic URL validation
  try {
    new URL(url);
  } catch (e) {
    return false;
  }
  
  // Ensure URL has valid image extension or is from a known image hosting service
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const isKnownImageService = [
    'digitaloceanspaces.com',
    'amazonaws.com',
    'cloudinary.com',
    'imgix.net',
    'googleapis.com'
  ].some(service => url.includes(service));
  
  return imageExtensions.some(ext => url.toLowerCase().endsWith(ext)) || isKnownImageService;
}
