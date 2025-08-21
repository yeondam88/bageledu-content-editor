# Project Brief: BagelEdu Content Editor

## Overview
BagelEdu Content Editor is a Next.js-based content management system designed for creating and managing bilingual (English/Korean) blog posts. The system integrates with GitHub for content storage and supports file uploads to DigitalOcean Spaces.

## Core Requirements

### Authentication
- **Google OAuth only**: Simple, secure authentication using Google accounts
- **Authorized users**: Access controlled via email whitelist
- **No password authentication**: Simplified login flow

### Content Management
- **Bilingual support**: Native English and Korean content creation
- **Markdown generation**: Automatic frontmatter and content generation
- **AI assistance**: OpenAI integration for content enhancement
- **File uploads**: Support for images and PDF documents

### File Handling
- **Image support**: JPEG, PNG, GIF, WebP, SVG
- **PDF support**: PDF document uploads for educational content
- **Cloud storage**: DigitalOcean Spaces integration
- **Size limits**: 5MB for images, 10MB for PDFs

### Technical Stack
- **Framework**: Next.js 15 with App Router
- **Authentication**: NextAuth.js with Google provider
- **Styling**: Tailwind CSS with shadcn/ui components
- **File storage**: AWS S3 SDK for DigitalOcean Spaces
- **AI**: OpenAI API integration
- **Version control**: GitHub API for content commits

## Success Criteria
1. Streamlined content creation workflow
2. Seamless file upload experience
3. Secure, simple authentication
4. Reliable cloud storage integration
5. AI-enhanced content generation
