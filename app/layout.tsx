import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { SiteHeader } from '@/components/site-header'
import { Providers } from '@/components/providers'
import { validateEnv } from '@/lib/validateEnv'

// Validate environment variables in development
// In production, this runs during build
if (process.env.NODE_ENV === 'development') {
  validateEnv();
}

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BagelEdu Content Editor',
  description: 'Create bilingual blog posts for BagelEdu website',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <SiteHeader />
            <div className="flex-1">{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  )
}
