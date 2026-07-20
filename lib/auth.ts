import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";
import { provisionTenantForUser } from "@/lib/tenant";

// Dev-only "sign in with a username, no password" provider — lets you
// exercise the dashboard without setting up Google OAuth. Deliberately
// excluded outside development: it authenticates anyone who types an
// existing username, no secret required.
const devUsernameProvider = Credentials({
  id: "credentials",
  name: "Username (dev only)",
  credentials: {
    username: { label: "Username", type: "text" },
  },
  async authorize(credentials) {
    const raw = typeof credentials?.username === "string" ? credentials.username : "";
    const username = raw.trim().toLowerCase();
    if (!username) return null;

    const email = `${username}@local.dev`;
    let [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user) {
      [user] = await db
        .insert(users)
        .values({ email, name: username })
        .returning();
      await provisionTenantForUser(user.id, username);
    }

    return { id: user.id, name: user.name, email: user.email };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    ...(process.env.NODE_ENV !== "production" ? [devUsernameProvider] : []),
  ],
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,
  events: {
    // A brand-new OAuth user has no tenant yet — provision one and make
    // them its owner. Runs once, right after the adapter inserts the user
    // row. (The dev username provider does this itself in authorize()
    // since it bypasses the adapter's createUser entirely.)
    async createUser({ user }) {
      if (!user.id) return;
      await provisionTenantForUser(user.id, user.email?.split("@")[0] ?? "New workspace");
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) {
        const [dbUser] = await db
          .select({ tenantId: users.tenantId, role: users.role })
          .from(users)
          .where(eq(users.id, user.id));
        token.tenantId = dbUser?.tenantId ?? null;
        token.role = dbUser?.role ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.tenantId = token.tenantId as string | null;
        session.user.role = token.role as string | null;
      }
      return session;
    },
  },
});
