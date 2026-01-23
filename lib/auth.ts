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
};

export const auth = () => getServerSession(authOptions);

const handler = NextAuth(authOptions);
export { handler };
