import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Store IP-based request timestamps
const requestCache = new Map<string, { timestamp: number[]; blocked: boolean }>();
const MAX_REQUESTS_PER_MINUTE = 60; // Maximum API requests per minute
const BLOCK_DURATION_MS = 60 * 1000; // Block duration in milliseconds (1 minute)

// List of allowed origins for CORS
const allowedOrigins = [
  'https://bageledu.com',
  'https://www.bageledu.com',
  // Add other domains you control
];

// Add development origins if not in production
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:3000');
  allowedOrigins.push('http://127.0.0.1:3000');
}

export function middleware(request: NextRequest) {
  // Only apply rate limiting to API routes
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // CORS check - only for API routes
  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins.includes(origin)) {
    return new NextResponse(
      JSON.stringify({ error: 'CORS error: Origin not allowed' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Get IP from headers or connection
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') ||
             'unknown';
             
  const now = Date.now();
  
  // Initialize or get cache entry for this IP
  if (!requestCache.has(ip)) {
    requestCache.set(ip, { timestamp: [now], blocked: false });
    return NextResponse.next();
  }
  
  const cacheEntry = requestCache.get(ip)!;

  // Check if IP is blocked
  if (cacheEntry.blocked) {
    // Check if block period has passed
    const latestRequest = Math.max(...cacheEntry.timestamp);
    if (now - latestRequest > BLOCK_DURATION_MS) {
      // Unblock after duration 
      cacheEntry.blocked = false;
      cacheEntry.timestamp = [now];
      requestCache.set(ip, cacheEntry);
      return NextResponse.next();
    }
    
    // Still blocked
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
        },
      }
    );
  }
  
  // Remove timestamps older than 1 minute
  cacheEntry.timestamp = cacheEntry.timestamp.filter(time => now - time < 60 * 1000);
  
  // Add current timestamp
  cacheEntry.timestamp.push(now);
  
  // Check rate limit
  if (cacheEntry.timestamp.length > MAX_REQUESTS_PER_MINUTE) {
    cacheEntry.blocked = true;
    requestCache.set(ip, cacheEntry);
    
    return new NextResponse(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
        },
      }
    );
  }
  
  // Update cache
  requestCache.set(ip, cacheEntry);
  
  // Add security headers
  const response = NextResponse.next();
  
  // Content Security Policy
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Relaxed for development, tighten in production
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.digitaloceanspaces.com",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join('; ');
  
  // Set security headers
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return response;
}

// Clean up the request cache periodically (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of requestCache.entries()) {
    // Clear entries older than 10 minutes
    if (data.timestamp.length === 0 || now - Math.max(...data.timestamp) > 10 * 60 * 1000) {
      requestCache.delete(ip);
    }
  }
}, 10 * 60 * 1000); // 10 minutes

// Configure which routes to apply the middleware to
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}; 