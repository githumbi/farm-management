import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";

import { upsertTenantForGoogle } from "@/lib/auth/upsertTenant";

declare module "next-auth" {
  interface Session {
    tenantId: string;
    userId: string;
    user: { id?: string } & DefaultSession["user"];
  }
}

type ShambaToken = {
  tenantId?: string;
  userId?: string;
  googleSub?: string;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      if (!profile?.sub || !profile.email) return false;
      await upsertTenantForGoogle({
        googleSub: profile.sub,
        email: profile.email,
        name: (profile.name as string | undefined) ?? null,
      });
      return true;
    },
    async jwt({ token, account, profile }) {
      const t = token as ShambaToken & typeof token;
      if (account?.provider === "google" && profile?.sub && profile.email) {
        const ctx = await upsertTenantForGoogle({
          googleSub: profile.sub,
          email: profile.email,
          name: (profile.name as string | undefined) ?? null,
        });
        t.tenantId = ctx.tenantId;
        t.userId = ctx.userId;
        t.googleSub = profile.sub;
      }
      return t;
    },
    async session({ session, token }) {
      const t = token as ShambaToken;
      if (t.tenantId) session.tenantId = t.tenantId;
      if (t.userId) {
        session.userId = t.userId;
        session.user = { ...session.user, id: t.userId };
      }
      return session;
    },
  },
});
