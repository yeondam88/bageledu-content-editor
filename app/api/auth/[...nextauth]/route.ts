import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Allowlist of authorized email addresses (add your team members' emails)
const AUTHORIZED_EMAILS: string[] = [
  // Add your email addresses here, for example:
  "ypark0719@gmail.com",
  "bageledu@gmail.com",
  "sohn0605@gmail.com"
];

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user }: { user: any }) {
      // Always allow sign in - we'll check authorization when using the API
      // This prevents the double Google sign-in prompt
      return true;
    },
    async jwt({ token, user }: { token: any; user: any }) {
      // Add isAuthorized flag to the JWT token
      if (user) {
        token.isAuthorized = 
          AUTHORIZED_EMAILS.length === 0 || 
          AUTHORIZED_EMAILS.includes(user.email?.toLowerCase());
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      // Add isAuthorized flag to the session
      session.user.isAuthorized = token.isAuthorized;
      return session;
    },
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
  // Set the debug option to false in production
  debug: process.env.NODE_ENV !== 'production',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
