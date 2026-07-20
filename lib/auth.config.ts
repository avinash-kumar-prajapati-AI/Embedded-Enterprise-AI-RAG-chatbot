import type { NextAuthConfig } from "next-auth";

// Edge-safe subset of the Auth.js config: no Node-only imports (crypto,
// postgres). This is what middleware runs — it only needs to decode the
// JWT session cookie, not touch the database. Providers live in lib/auth.ts
// (the admin-ID provider needs DB access), not here.
export const authConfig: NextAuthConfig = {
  providers: [],
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request }) {
      const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
      return isDashboard ? !!auth : true;
    },
  },
};
