"use client";

import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from '@/components/ui/use-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </SessionProvider>
  );
} 