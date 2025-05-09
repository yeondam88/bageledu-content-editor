"use client";

import Link from "next/link";
import { MainNav } from "@/components/main-nav";
import { Button } from "@/components/ui/button";
import { useSession, signIn, signOut } from "next-auth/react";

export function SiteHeader() {
  const { data: session, status } = useSession();

  return (
    <header className="w-full border-b bg-background">
      <div className="flex flex-row justify-between p-4 max-w-7xl mx-auto">
        <div className="flex gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            <img src="https://www.bageledu.com/images/bageledu/BagelEducation6.png" alt="BagelEdu Logo" className="h-8" />
          </Link>
          <MainNav />
        </div>
        <div className="">
          {session ? (
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {session.user?.email}
              </div>
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                Sign Out
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => signIn()}>
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
} 