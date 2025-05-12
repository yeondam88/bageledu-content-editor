"use client";

import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  
  let errorMessage = "An unexpected error occurred during authentication.";
  let errorDescription = "Please try again or contact support if the problem persists.";
  
  // Customize error messages based on the error code
  if (error === "Configuration") {
    errorMessage = "Server configuration error";
    errorDescription = "There is a problem with the server configuration. Please contact support.";
  } else if (error === "AccessDenied") {
    errorMessage = "Access denied";
    errorDescription = "You do not have permission to sign in. Contact the administrator for access.";
  } else if (error === "OAuthSignin" || error === "OAuthCallback" || error === "OAuthCreateAccount") {
    errorMessage = "Google authentication error";
    errorDescription = "There was a problem with Google authentication. Please try again.";
  } else if (error === "Callback") {
    errorMessage = "Authentication callback error";
    errorDescription = "There was a problem with the authentication callback. Please try again.";
  } else if (error === "OAuthAccountNotLinked") {
    errorMessage = "Account not linked";
    errorDescription = "You may have already signed up with a different sign-in method.";
  }
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="https://www.bageledu.com/images/bageledu/BagelEducation6.png" 
              alt="BagelEdu Logo" 
              className="h-10"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-red-600">{errorMessage}</CardTitle>
          <CardDescription className="mt-2">{errorDescription}</CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center pb-6 gap-4">
          <Button asChild variant="outline">
            <Link href="/">
              Go Home
            </Link>
          </Button>
          <Button asChild>
            <Link href="/auth/signin">
              Try Again
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 