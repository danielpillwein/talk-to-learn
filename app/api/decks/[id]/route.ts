import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type CardPayload = {
  id?: string;
  question: string;
  answer: string;
};

export async function GET(request: NextRequest, context: { params: { id: string } }): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deckId = context.params.id;
    const deck = await db.deck.findUnique({
      where: { id: deckId, ownerId: session.user.id },
      select: {
        id: true,
        title: true,
        cards: {
          orderBy: { createdAt: "asc" },
          select: { id: true, question: true, answer: true },
        },
      },
    });

    if (!deck) {
      return NextResponse.json({ error: "Lernset nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(deck);
  } catch (error) {
    console.error("Error loading deck:", error);
    return NextResponse.json({ error: "Lernset konnte nicht geladen werden" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: { params: { id: string } }): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deckId = context.params.id;
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const cards = (body.cards as CardPayload[] | undefined) ?? [];

    const cleanedCards = cards
      .map((card) => ({
        id: card.id,
        question: String(card.question ?? "").trim(),
        answer: String(card.answer ?? "").trim(),
      }))
      .filter((card) => card.question && card.answer);

    if (!title || cleanedCards.length === 0) {
      return NextResponse.json({ error: "title and cards are required" }, { status: 400 });
    }

    const deck = await db.deck.findUnique({
      where: { id: deckId, ownerId: session.user.id },
      select: { id: true },
    });

    if (!deck) {
      return NextResponse.json({ error: "Lernset nicht gefunden" }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      await tx.deck.update({
        where: { id: deck.id },
        data: { title },
      });

      const existingCards = await tx.card.findMany({
        where: { deckId: deck.id },
        select: { id: true },
      });
      const existingIds = new Set(existingCards.map((card) => card.id));

      const incomingIds = new Set(
        cleanedCards.map((card) => card.id).filter((id): id is string => !!id)
      );

      const deleteIds = existingCards
        .filter((card) => !incomingIds.has(card.id))
        .map((card) => card.id);

      if (deleteIds.length > 0) {
        await tx.card.deleteMany({ where: { id: { in: deleteIds } } });
      }

      const updateCards = cleanedCards.filter((card) => card.id && existingIds.has(card.id));
      await Promise.all(
        updateCards.map((card) =>
          tx.card.update({
            where: { id: card.id! },
            data: { question: card.question, answer: card.answer },
          })
        )
      );

      const newCards = cleanedCards.filter((card) => !card.id);
      if (newCards.length > 0) {
        await tx.card.createMany({
          data: newCards.map((card) => ({
            deckId: deck.id,
            question: card.question,
            answer: card.answer,
          })),
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating deck:", error);
    return NextResponse.json({ error: "Lernset konnte nicht aktualisiert werden" }, { status: 500 });
  }
}
