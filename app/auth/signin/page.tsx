"use client";

import { signIn } from "next-auth/react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { useState, Suspense } from "react";

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [email, setEmail] = useState("");
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 px-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <div className="absolute top-4 right-4">
          <button className="text-gray-400 hover:text-gray-600" onClick={() => window.history.back()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className="flex justify-center pt-6 pb-2">
          <div className="bg-gray-100 rounded-full p-4 w-16 h-16 flex items-center justify-center">
            <div className="w-8 h-8 bg-black rounded-full"></div>
          </div>
        </div>
        
        <CardHeader className="text-center space-y-1 pt-2 pb-4">
          <CardTitle className="text-2xl font-semibold">Welcome back</CardTitle>
          <CardDescription className="text-gray-500">
            Enter your credentials to login to your account.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4 px-6">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <Input 
              id="email" 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full py-2 px-3"
              placeholder=""
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
            </div>
            <Input 
              id="password" 
              type="password" 
              className="w-full py-2 px-3"
              placeholder="Enter your password"
            />
            <div className="flex justify-between items-center pt-2">
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="remember" className="rounded border-gray-300" />
                <label htmlFor="remember" className="text-sm text-gray-500">Remember me</label>
              </div>
              <a href="#" className="text-sm text-black hover:underline">Forgot password?</a>
            </div>
          </div>
          
          <Button 
            onClick={() => {}} 
            className="w-full bg-black text-white hover:bg-gray-800"
          >
            Sign in
          </Button>
          
          <div className="relative flex items-center justify-center">
            <div className="border-t border-gray-200 w-full"></div>
            <span className="bg-white px-3 text-sm text-gray-500 absolute">Or</span>
          </div>
          
          <Button 
            onClick={() => signIn("google", { callbackUrl })} 
            variant="outline"
            className="w-full border-gray-300 text-black hover:bg-gray-50"
          >
            Login with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-900 px-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <div className="flex justify-center pt-6 pb-2">
            <div className="bg-gray-100 rounded-full p-4 w-16 h-16 flex items-center justify-center">
              <div className="w-8 h-8 bg-black rounded-full"></div>
            </div>
          </div>
          <CardHeader className="text-center space-y-1 pt-2 pb-4">
            <CardTitle className="text-2xl font-semibold">Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
} 