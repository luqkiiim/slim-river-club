import { compare } from "bcryptjs";
import { type NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";

const TOKEN_REFRESH_INTERVAL_MS = 60_000;

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          return null;
        }

        if (!user.passwordHash || !user.email) {
          return null;
        }

        const passwordMatches = await compare(password, user.passwordHash);

        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
          isParticipant: user.isParticipant,
          goalReached: user.goalReached,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = user.isAdmin;
        token.isParticipant = user.isParticipant;
        token.goalReached = user.goalReached;
        token.userSyncedAt = Date.now();
      }

      const lastSyncedAt = typeof token.userSyncedAt === "number" ? token.userSyncedAt : 0;

      if (token.id && Date.now() - lastSyncedAt > TOKEN_REFRESH_INTERVAL_MS) {
        const freshUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            name: true,
            email: true,
            isAdmin: true,
            isParticipant: true,
            goalReached: true,
          },
        });

        if (freshUser) {
          token.name = freshUser.name;
          token.email = freshUser.email;
          token.isAdmin = freshUser.isAdmin;
          token.isParticipant = freshUser.isParticipant;
          token.goalReached = freshUser.goalReached;
          token.userSyncedAt = Date.now();
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.isAdmin = Boolean(token.isAdmin);
        session.user.isParticipant = Boolean(token.isParticipant);
        session.user.goalReached = Boolean(token.goalReached);
        session.user.name = token.name ?? session.user.name;
        session.user.email = token.email ?? session.user.email;
      }

      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export function getServerAuthSession() {
  return getServerSession(authOptions);
}
