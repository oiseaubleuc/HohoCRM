import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const emailRaw = credentials?.email;
        const passwordRaw = credentials?.password;
        if (!emailRaw || !passwordRaw) return null;
        const email = String(emailRaw).toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(String(passwordRaw), user.passwordHash);
        if (!valid) return null;
        const membership = await prisma.membership.findFirst({
          where: { userId: user.id, acceptedAt: { not: null } },
        });
        if (!membership) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.avatarUrl ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.sub = user.id;
        const membership = await prisma.membership.findFirst({
          where: { userId: user.id, acceptedAt: { not: null } },
          orderBy: { invitedAt: "asc" },
          include: { tenant: true },
        });
        if (membership) {
          token.tenantId = membership.tenantId;
          token.role = membership.role;
          token.tenantSlug = membership.tenant.slug;
          token.tenantName = membership.tenant.name;
        } else {
          token.tenantId = "";
          token.role = "";
          token.tenantSlug = null;
          token.tenantName = null;
        }
      }
      if (trigger === "update" && session?.activeTenantId && token.sub) {
        const m = await prisma.membership.findUnique({
          where: {
            tenantId_userId: {
              tenantId: session.activeTenantId as string,
              userId: token.sub,
            },
          },
          include: { tenant: true },
        });
        if (m) {
          token.tenantId = m.tenantId;
          token.role = m.role;
          token.tenantSlug = m.tenant.slug;
          token.tenantName = m.tenant.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.tenantId = (token.tenantId as string) ?? "";
        session.user.role = (token.role as string) ?? "";
        session.user.tenantSlug = (token.tenantSlug as string | null) ?? null;
        session.user.tenantName = (token.tenantName as string | null) ?? null;
      }
      return session;
    },
  },
});
