# System Patterns: BagelEdu Content Editor

## Architecture Overview

### Next.js App Router Structure
```
app/
├── api/                  # Backend API routes
│   ├── auth/            # NextAuth.js configuration
│   ├── upload/          # File upload handling
│   ├── github/          # GitHub API integration
│   └── openai/          # AI content generation
├── auth/                # Authentication pages
├── editor/              # Main content editor
└── components/          # Shared UI components
```

### Key Technical Decisions

#### Authentication Architecture
- **NextAuth.js**: Handles OAuth flow and session management
- **Google Provider**: Single authentication method
- **Email whitelist**: Authorization layer in JWT callbacks
- **Session persistence**: Automatic redirect handling

#### File Upload System
- **FormData API**: Modern file upload handling
- **AWS S3 SDK**: DigitalOcean Spaces integration
- **Validation layers**: File type, size, and format checks
- **URL generation**: Proper region-specific URLs

#### Content Management
- **React Hook Form**: Form state management
- **Live preview**: Real-time markdown generation
- **Auto-save**: localStorage for draft persistence
- **GitHub integration**: Direct commit to repository

## Component Patterns

### Form Management
```typescript
// Unified form handling for bilingual content
const { register, handleSubmit, watch, getValues, reset } = useForm({
  defaultValues: {
    title_en: "", title_ko: "",
    content_en: "", content_ko: "",
    file: undefined
  }
});
```

### File Upload Pattern
```typescript
// Generic file handling (images + PDFs)
const handleUpload = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  // Upload and handle response
};
```

### State Management
- **React hooks**: useState for UI state
- **Form state**: React Hook Form for form data
- **Session state**: NextAuth useSession hook
- **LocalStorage**: Draft persistence

## API Patterns

### Upload Endpoint (`/api/upload`)
- **Input validation**: File type and size checks
- **S3 integration**: Direct upload to DigitalOcean Spaces
- **Error handling**: Detailed error responses
- **URL formatting**: Region-specific URL generation

### GitHub Integration (`/api/github`)
- **Content commits**: Direct markdown file creation
- **Authentication**: GitHub token validation
- **Path generation**: Automatic slug-based file paths

### AI Integration (`/api/openai`)
- **Content enhancement**: Bilingual content suggestions
- **Context awareness**: File and metadata consideration
- **Structured responses**: Consistent JSON format

## Security Patterns

### Authentication Flow
1. **Google OAuth**: Secure third-party authentication
2. **Email validation**: Whitelist-based authorization
3. **JWT tokens**: Secure session management
4. **Redirect protection**: URL validation for callbacks

### File Upload Security
- **Type validation**: Strict MIME type checking
- **Size limits**: Reasonable file size restrictions
- **Path sanitization**: Safe file naming
- **Public access**: Read-only public URLs

## Error Handling Patterns

### Client-side
- **Form validation**: Real-time field validation
- **Upload feedback**: Progress and error states
- **Network errors**: Graceful degradation
- **User messaging**: Clear error communication

### Server-side
- **Input validation**: Comprehensive request validation
- **External API errors**: Proper error propagation
- **Authentication errors**: Secure error responses
- **File handling errors**: Detailed upload feedback
