import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type DangerAction = "reset_progress" | "delete_decks";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { action?: string } | null;
    const action = body?.action as DangerAction | undefined;

    if (action !== "reset_progress" && action !== "delete_decks") {
      return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
    }

    const ownedDecks = await db.deck.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });

    const deckIds = ownedDecks.map((deck) => deck.id);

    if (deckIds.length === 0) {
      return NextResponse.json({ ok: true, affectedDecks: 0 });
    }

    if (action === "delete_decks") {
      const result = await db.deck.deleteMany({
        where: { ownerId: userId },
      });

      return NextResponse.json({ ok: true, affectedDecks: result.count });
    }

    await db.$transaction(async (tx) => {
      await tx.reviewProgress.deleteMany({
        where: {
          userId,
          deckId: { in: deckIds },
        },
      });

      await tx.deck.updateMany({
        where: {
          id: { in: deckIds },
          ownerId: userId,
        },
        data: {
          hasBeenIntroduced: false,
          learningPhase: "intro",
        },
      });

      await tx.card.updateMany({
        where: {
          deckId: { in: deckIds },
        },
        data: {
          seen: false,
          hasScaffoldedExplanation: false,
          state: "unseen",
        },
      });
    });

    return NextResponse.json({ ok: true, affectedDecks: deckIds.length });
  } catch (error) {
    console.error("Error executing danger action:", error);
    return NextResponse.json({ error: "Aktion konnte nicht ausgeführt werden" }, { status: 500 });
  }
}
