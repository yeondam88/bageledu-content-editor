"use client";

import { useState } from "react";
import Link from "next/link";
import { MainNav } from "@/components/main-nav";
import { Button } from "@/components/ui/button";
import { useSession, signIn, signOut } from "next-auth/react";
import { Menu, X } from "lucide-react";

export function SiteHeader() {
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <header className="w-full border-b bg-background sticky top-0 z-50 shadow-sm">
      <div className="flex flex-row justify-between items-center py-3 px-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/" className="flex items-center">
            <img 
              src="https://www.bageledu.com/images/bageledu/BagelEducation6.png" 
              alt="BagelEdu Logo" 
              className="h-8 sm:h-10"
            />
          </Link>
          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <MainNav />
          </div>
        </div>
        
        {/* Mobile menu button */}
        <button 
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors focus:outline-none" 
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        
        {/* Desktop User Menu */}
        <div className="hidden md:block">
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
            <Button 
              size="sm" 
              onClick={() => signIn()}
              className="bg-black text-white hover:bg-gray-800"
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
      
      {/* Mobile Navigation Dropdown */}
      {isMenuOpen && (
        <div className="md:hidden p-4 border-t bg-background animate-in slide-in-from-top">
          <nav className="flex flex-col space-y-4 mb-4">
            <MainNav isMobile={true} />
          </nav>
          
          {/* Mobile User Menu */}
          <div className="pt-4 border-t border-gray-100">
            {session ? (
              <div className="flex flex-col gap-4">
                <div className="text-sm text-muted-foreground">
                  {session.user?.email}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full justify-center" 
                  onClick={() => signOut()}
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button 
                className="w-full justify-center bg-black text-white hover:bg-gray-800" 
                onClick={() => signIn()}
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
} 