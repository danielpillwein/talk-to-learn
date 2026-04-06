import type { Session } from "next-auth";
import { db } from "@/lib/db";

type SessionUser = Session["user"];

export type ResolvedSessionUser = {
  id: string;
  email: string | null;
};

function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

async function findUserByEmailCaseInsensitive(email: string): Promise<ResolvedSessionUser | null> {
  const rows = await db.$queryRawUnsafe<Array<{ id: string; email: string | null }>>(
    `SELECT "id","email" FROM "User" WHERE lower("email") = lower(?) LIMIT 1`,
    email
  );
  if (!rows[0]?.id) return null;
  return {
    id: rows[0].id,
    email: rows[0].email,
  };
}

export async function resolveOrCreateSessionUser(
  user: SessionUser | null | undefined
): Promise<ResolvedSessionUser | null> {
  const userId = String(user?.id ?? "").trim();
  const emailRaw = normalizeEmail(user?.email);
  const nameRaw = String(user?.name ?? "").trim() || null;
  const imageRaw = String(user?.image ?? "").trim() || null;

  if (!userId && !emailRaw) {
    return null;
  }

  if (userId) {
    const byId = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (byId) return byId;
  }

  if (emailRaw) {
    const byEmail = await db.user.findUnique({
      where: { email: emailRaw },
      select: { id: true, email: true },
    });
    if (byEmail) return byEmail;

    const byEmailInsensitive = await findUserByEmailCaseInsensitive(emailRaw);
    if (byEmailInsensitive) return byEmailInsensitive;
  }

  if (!emailRaw) return null;

  try {
    return await db.user.create({
      data: {
        email: emailRaw,
        name: nameRaw,
        image: imageRaw,
        plan: "free",
      },
      select: { id: true, email: true },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("UNIQUE constraint failed")) {
      throw error;
    }
    return findUserByEmailCaseInsensitive(emailRaw);
  }
}
