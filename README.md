This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Authentication Setup

1. Create a `.env.local` file in the project root with the following variables:

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_SECRET=your-random-secret
NEXTAUTH_URL=http://localhost:3000
```

2. Get Google OAuth credentials from https://console.developers.google.com/
3. Use a strong random string for NEXTAUTH_SECRET (e.g., `openssl rand -base64 32`).

## DigitalOcean Spaces Setup (Image Upload)

Add these to your `.env.local`:
```
DO_SPACES_KEY=your-access-key
DO_SPACES_SECRET=your-secret-key
DO_SPACES_ENDPOINT=https://your-region.digitaloceanspaces.com
DO_SPACES_REGION=your-region
DO_SPACES_BUCKET=your-space-name
```

## GitHub API Setup (Markdown Commit)

Add these to your `.env.local`:
```
GITHUB_TOKEN=your-github-pat
GITHUB_OWNER=your-github-username-or-org
GITHUB_REPO=your-repo-name
GITHUB_BRANCH=main
```
