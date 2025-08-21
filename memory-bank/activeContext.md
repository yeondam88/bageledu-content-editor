# Active Context: Current Implementation Status

## Recent Changes (Latest Session)

### Authentication Simplification ✅
- **Completed**: Removed email/password authentication
- **Result**: Sign-in page now shows only Google OAuth button
- **Impact**: Cleaner, more secure authentication flow

### PDF Upload Support ✅
- **Backend**: Updated `/api/upload` route to accept PDF files
- **Frontend**: Modified editor to handle both images and PDFs
- **File handling**: Increased size limits (10MB for PDFs, 5MB for images)
- **UI updates**: Added PDF preview with document icon and download link

## Current Focus
- **File upload system**: Enhanced to support educational documents
- **User experience**: Streamlined authentication process
- **Content types**: Extended beyond images to include PDFs

## Active Decisions

### File Upload Strategy
- **Form field name**: Changed from "image" to "file" for better semantics
- **Accept types**: `image/*,application/pdf`
- **Size validation**: Dynamic based on file type
- **Preview handling**: Different UI for PDFs vs images

### Authentication Approach
- **OAuth only**: Simplified to Google authentication
- **Authorization**: Maintained email whitelist system
- **UI**: Clean, single-button sign-in interface

## Next Steps (Potential)
1. **Testing**: Verify PDF upload functionality
2. **User feedback**: Gather input on new authentication flow
3. **Documentation**: Update user guides for PDF support
4. **Optimization**: Consider file compression for large PDFs

## Technical Notes
- Upload API now uses generic "file" parameter instead of "image"
- Frontend state management updated (fileUrl instead of imageUrl)
- Markdown generation supports both image and PDF frontmatter
- Error handling improved for different file types
