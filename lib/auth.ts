import NextAuth, { type NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";

import { db } from "./db";

const providers = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  }),
];

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    session({ session, user, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = user?.id ?? token?.sub;
      }
      return session;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
  },
};

export const auth = () => getServerSession(authOptions);

const handler = NextAuth(authOptions);
export { handler };
