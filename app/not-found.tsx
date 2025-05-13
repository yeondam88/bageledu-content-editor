import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
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
          <CardTitle className="text-2xl font-bold">Page Not Found</CardTitle>
          <CardDescription className="mt-2">
            Sorry, the page you're looking for doesn't exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center pb-6">
          <Button asChild>
            <Link href="/">
              Go Home
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 