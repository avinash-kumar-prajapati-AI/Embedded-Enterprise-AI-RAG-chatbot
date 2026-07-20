import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getOrCreateDemoTenant } from "@/lib/demo";

// The only way into the dashboard: a single long secret (ADMIN_LOGIN_ID)
// known only to the site owner. There is no public signup — this app has
// exactly one tenant (the same one the public homepage demo uses), managed
// by its one admin.
const adminIdProvider = Credentials({
  id: "credentials",
  name: "Admin ID",
  credentials: {
    adminId: { label: "Admin ID", type: "password" },
  },
  async authorize(credentials) {
    const adminId = typeof credentials?.adminId === "string" ? credentials.adminId : "";
    const expected = process.env.ADMIN_LOGIN_ID;
    if (!expected || !adminId || adminId !== expected) return null;

    const demoTenant = await getOrCreateDemoTenant();
    const email = "admin@internal";

    let [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      [user] = await db
        .insert(users)
        .values({ email, name: "Admin", tenantId: demoTenant.id, role: "owner" })
        .returning();
    } else if (user.tenantId !== demoTenant.id) {
      [user] = await db
        .update(users)
        .set({ tenantId: demoTenant.id, role: "owner" })
        .where(eq(users.id, user.id))
        .returning();
    }

    return { id: user.id, name: user.name, email: user.email };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [adminIdProvider],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,
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
