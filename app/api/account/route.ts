import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "Account nicht gefunden" }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      // Decks zuerst löschen, damit keine verwaisten Datensätze mit ownerId = null entstehen.
      await tx.deck.deleteMany({
        where: { ownerId: userId },
      });

      await tx.user.delete({
        where: { id: userId },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json({ error: "Account konnte nicht gelöscht werden" }, { status: 500 });
  }
}

