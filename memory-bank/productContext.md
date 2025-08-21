# Product Context: BagelEdu Content Editor

## Problem Statement
Educational content creators need a streamlined system to produce bilingual blog posts with proper formatting, file attachments, and version control. Traditional CMSs are either too complex or lack the specific features needed for educational content.

## Solution
A specialized content editor that:
- Simplifies bilingual content creation
- Handles educational file uploads (images and PDFs)
- Integrates with existing development workflows via GitHub
- Provides AI assistance for content enhancement

## User Experience Goals

### Content Creators
- **Intuitive interface**: Clean, distraction-free editing environment
- **Bilingual workflow**: Side-by-side English/Korean content editing
- **File management**: Drag-and-drop uploads with automatic optimization
- **Preview system**: Real-time markdown preview with proper formatting

### Administrators
- **Access control**: Easy user management via email whitelist
- **Content oversight**: GitHub integration for review workflows
- **File organization**: Structured storage in DigitalOcean Spaces

## Key Features

### Editor Interface
- Split-view editing (form/preview)
- Live markdown generation
- File upload with preview
- Auto-save functionality
- AI content assistance

### Authentication Flow
- Single-click Google sign-in
- Automatic authorization check
- Seamless redirect handling
- Error state management

### File Upload System
- Multi-format support (images + PDFs)
- Progress indication
- Error handling
- Cloud storage integration
- URL generation for content embedding

## Content Structure
Generated content follows a structured format:
- YAML frontmatter with metadata
- Bilingual title and excerpt fields
- File attachments (image or PDF)
- Category and tag organization
- Author attribution
