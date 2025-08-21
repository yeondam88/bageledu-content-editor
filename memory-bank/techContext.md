# Tech Context: BagelEdu Content Editor

## Technology Stack

### Core Framework
- **Next.js 15**: App Router, Server Components, API Routes
- **React 19**: Latest React features and hooks
- **TypeScript 5**: Full type safety across the application

### Authentication
- **NextAuth.js 4.24**: OAuth provider management
- **Google OAuth**: Single sign-on integration
- **JWT**: Secure session management

### UI & Styling
- **Tailwind CSS 4**: Utility-first styling
- **shadcn/ui**: High-quality component library
- **Radix UI**: Accessible component primitives
- **Framer Motion**: Smooth animations

### File Management
- **AWS S3 SDK**: DigitalOcean Spaces integration
- **FormData API**: Modern file upload handling
- **Sharp**: Image optimization (server-side)

### Content Processing
- **React Markdown**: Markdown rendering
- **React Hook Form**: Form state management
- **OpenAI API**: AI content generation

### Development Tools
- **ESLint**: Code linting and formatting
- **Turbopack**: Fast development builds
- **TypeScript**: Static type checking

## Environment Configuration

### Required Environment Variables
```env
# Authentication
NEXTAUTH_SECRET=your_secret_here
NEXTAUTH_URL=https://your-domain.com
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# File Storage (DigitalOcean Spaces)
DO_SPACES_KEY=your_spaces_key
DO_SPACES_SECRET=your_spaces_secret
DO_SPACES_ENDPOINT=https://sfo3.digitaloceanspaces.com
DO_SPACES_BUCKET=your_bucket_name
DO_SPACES_REGION=sfo3

# AI Integration
OPENAI_API_KEY=your_openai_api_key

# GitHub Integration
GITHUB_TOKEN=your_github_token
GITHUB_REPO_OWNER=your_username
GITHUB_REPO_NAME=your_repo_name
```

## Dependencies

### Production Dependencies
```json
{
  "@aws-sdk/client-s3": "^3.804.0",
  "next": "15.3.2",
  "next-auth": "^4.24.11",
  "react": "^19.0.0",
  "react-hook-form": "^7.56.2",
  "openai": "^4.98.0",
  "tailwindcss": "^4"
}
```

### Key Features by Version
- **Next.js 15**: App Router, Turbopack, improved performance
- **React 19**: New hooks, improved Suspense
- **NextAuth 4.24**: Latest OAuth improvements
- **Tailwind 4**: New features and optimizations

## Development Setup

### Local Development
```bash
npm install           # Install dependencies
npm run dev          # Start development server (with Turbopack)
npm run build        # Production build
npm run lint         # Run ESLint
```

### File Structure
```
├── app/             # Next.js App Router
├── components/      # Shared UI components
├── lib/            # Utility functions
├── utils/          # Supabase and other utilities
├── public/         # Static assets
└── memory-bank/    # Project documentation
```

## Technical Constraints

### File Upload Limits
- **Images**: 5MB maximum size
- **PDFs**: 10MB maximum size
- **Types**: JPEG, PNG, GIF, WebP, SVG, PDF

### Authentication Constraints
- **Google OAuth only**: No other providers currently supported
- **Email whitelist**: Manual user management required
- **Session duration**: Standard NextAuth.js defaults

### API Rate Limits
- **OpenAI**: Standard API rate limits apply
- **GitHub**: GitHub API rate limits for commits
- **DigitalOcean**: Spaces API limits

## Deployment Considerations

### Production Environment
- **Vercel**: Recommended deployment platform
- **Environment variables**: All secrets must be configured
- **Domain configuration**: Proper NEXTAUTH_URL setting
- **HTTPS required**: For OAuth and secure cookies

### Performance Optimizations
- **Image optimization**: Next.js automatic optimization
- **Code splitting**: Automatic with App Router
- **Caching**: Static generation where possible
- **CDN**: DigitalOcean Spaces with CDN for files
