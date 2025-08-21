# Supabase Storage Setup for Image Assets

## Step 1: Environment Variables

Following the [official Supabase Next.js guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs), add these to your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key-here
```

**Where to find these values:**

1. Go to your Supabase dashboard
2. Go to **Settings** → **API**
3. Copy the **Project URL** for `NEXT_PUBLIC_SUPABASE_URL`
4. Copy the **anon public** key for `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

**Note**: We're using the anon (publishable) key because our API routes handle authentication via NextAuth, and Supabase RLS policies will control access.

## Step 2: Create the Storage Bucket

1. Go to your Supabase dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"Create a new bucket"**
4. Configure the bucket:
   - **Name**: `image-assets`
   - **Public bucket**: ✅ **Check this box** (important!)
   - **File size limit**: 50MB (optional)
   - **Allowed MIME types**: Leave empty for all types
5. Click **"Create bucket"**

## Step 3: Set Storage Policies

Go to **Storage** > **Policies** tab and create these policies:

### Policy 1: Allow public uploads (our API controls auth)

```sql
CREATE POLICY "Allow public uploads to image-assets"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'image-assets');
```

### Policy 2: Allow public viewing

```sql
CREATE POLICY "Allow public viewing of image-assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'image-assets');
```

### Policy 3: Allow public deletes (our API controls auth)

```sql
CREATE POLICY "Allow public deletes from image-assets"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'image-assets');
```

**Important**: The security is handled by our NextAuth-protected API routes, not by Supabase auth. This is why we use public policies but control access through our `/api/image-assets` endpoint.

## Step 4: Quick Setup via SQL Editor

Alternatively, run this in **SQL Editor**:

```sql
-- Enable RLS on storage.objects (should already be enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create upload policy
CREATE POLICY "Allow public uploads to image-assets" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'image-assets');

-- Create view policy
CREATE POLICY "Allow public viewing of image-assets" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'image-assets');

-- Create delete policy
CREATE POLICY "Allow public deletes from image-assets" ON storage.objects
FOR DELETE TO public
USING (bucket_id = 'image-assets');
```

## Step 5: Verify Setup

1. ✅ Bucket `image-assets` exists and is marked as **public**
2. ✅ Environment variables are correctly set
3. ✅ Service role key (not anon key) is used in the API
4. ✅ Storage policies are created and active

## Troubleshooting

**"Bucket not found"**:

- Ensure bucket name is exactly `image-assets`
- Verify bucket exists in Supabase dashboard

**"Row-level security policy violation"**:

- Check that storage policies are created
- Ensure bucket is marked as public
- Verify you're using the service role key, not anon key

**"Unauthorized"**:

- Confirm `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Check the service role key has storage permissions

Once this is set up, your image uploads should work perfectly! 🚀
