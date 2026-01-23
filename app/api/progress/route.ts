import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  applyReviewOutcome,
  computeNextQuestionId,
  computeStats,
  ensureDeckProgress,
  getDeckByFilename,
  getDeckCards,
  resetDeckProgress,
} from "@/lib/progress";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deckId = request.nextUrl.searchParams.get("deckId");
  if (!deckId) {
    return NextResponse.json({ error: "deckId is required" }, { status: 400 });
  }

  const deck = await getDeckByFilename(deckId, session.user.id);
  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const { cards, progress } = await ensureDeckProgress(session.user.id, deck.id);
  const cardIdToIndex = new Map(cards.map((card, index) => [card.id, index]));

  return NextResponse.json({
    stats: computeStats(progress, cards.length),
    nextQuestionId: computeNextQuestionId(progress, cardIdToIndex),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const deckId = body.deckId as string | undefined;
  const action = (body.action as string | undefined) ?? "review";

  if (!deckId) {
    return NextResponse.json({ error: "deckId is required" }, { status: 400 });
  }

  const deck = await getDeckByFilename(deckId, session.user.id);
  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  if (action === "reset") {
    await resetDeckProgress(session.user.id, deck.id);
  } else {
    const questionId = body.questionId as number | undefined;
    const outcome = body.outcome as "known" | "review" | "wrong" | undefined;

    if (typeof questionId !== "number" || !outcome) {
      return NextResponse.json(
        { error: "questionId and outcome are required" },
        { status: 400 }
      );
    }

    const cards = await getDeckCards(deck.id);
    const card = cards[questionId];
    if (!card) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    await applyReviewOutcome({
      userId: session.user.id,
      deckId: deck.id,
      cardId: card.id,
      outcome,
    });
  }

  const { cards, progress } = await ensureDeckProgress(session.user.id, deck.id);
  const cardIdToIndex = new Map(cards.map((card, index) => [card.id, index]));

  return NextResponse.json({
    stats: computeStats(progress, cards.length),
    nextQuestionId: computeNextQuestionId(progress, cardIdToIndex),
  });
}
