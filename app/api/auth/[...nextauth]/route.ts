import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // Allow redirects to the original URL, admin domain, or to the base URL
      if (url.startsWith(baseUrl) || 
          url.startsWith("https://admin.bageledu.com") || 
          url.startsWith("https://bageledu.com")) {
        return url;
      }
      return baseUrl;
    }
  },
  // Trust the admin domain
  trustHost: true,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
