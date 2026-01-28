import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type CardPayload = { question: string; answer: string };

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const cards = (body.cards as CardPayload[] | undefined) ?? [];

  if (!title || cards.length === 0) {
    return NextResponse.json({ error: "title and cards are required" }, { status: 400 });
  }

  const deck = await db.deck.create({
    data: {
      title,
      ownerId: session.user.id,
      sourceFilename: `${title.toLowerCase().replace(/\s+/g, "_")}-${Date.now()}.ai`,
      sourceType: "ai",
    },
  });

  await db.card.createMany({
    data: cards.map((card) => ({
      deckId: deck.id,
      question: String(card.question).trim(),
      answer: String(card.answer).trim(),
    })),
  });

  return NextResponse.json({ deckId: deck.id });
}
