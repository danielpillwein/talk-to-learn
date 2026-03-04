import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  applyReviewOutcome,
  applyKnownUnknownSkip,
  computeNextQuestionId,
  computeStats,
  deriveLearningStage,
  ensureDeckProgress,
  getDeckByFilename,
  getDeckCards,
  markCardScaffoldedExplanation,
  markCardSeenAndAdvanceDeck,
  resetDeckProgress,
} from "@/lib/progress";

function toDisplayStats(
  learningStage: "intro" | "scaffolded" | "free",
  cards: Array<{ seen: boolean }>,
  progress: Array<{ status: string }>
) {
  if (learningStage === "intro") {
    const known = cards.reduce((acc, card) => (card.seen ? acc + 1 : acc), 0);
    return {
      known,
      learning: 0,
      new: Math.max(0, cards.length - known),
    };
  }

  return computeStats(progress, cards.length);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
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
    return NextResponse.json({ error: "Lernset nicht gefunden" }, { status: 404 });
  }

  const { cards, progress } = await ensureDeckProgress(session.user.id, deck.id);
  const cardIdToIndex = new Map(cards.map((card, index) => [card.id, index]));
  const learningStage = deriveLearningStage({
    hasBeenIntroduced: deck.hasBeenIntroduced,
    learningPhase: deck.learningPhase,
    cards,
    progress,
  });

  return NextResponse.json({
    stats: toDisplayStats(learningStage, cards, progress),
    nextQuestionId: computeNextQuestionId(learningStage, cards, progress, cardIdToIndex),
    learningPhase: learningStage,
    learningStage,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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
    return NextResponse.json({ error: "Lernset nicht gefunden" }, { status: 404 });
  }

  if (action === "reset") {
    await resetDeckProgress(session.user.id, deck.id);
    await Promise.all([
      db.deck.update({
        where: { id: deck.id, ownerId: session.user.id },
        data: {
          hasBeenIntroduced: false,
          learningPhase: "intro",
        },
      }),
      db.card.updateMany({
        where: { deckId: deck.id },
        data: {
          seen: false,
          hasScaffoldedExplanation: false,
          state: "unseen",
        },
      }),
    ]);
  } else if (action === "mark_seen") {
    const questionId = body.questionId as number | undefined;
    if (typeof questionId !== "number") {
      return NextResponse.json({ error: "questionId is required" }, { status: 400 });
    }

    const cards = await getDeckCards(deck.id);
    const card = cards[questionId];
    if (!card) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    await markCardSeenAndAdvanceDeck({
      userId: session.user.id,
      deckId: deck.id,
      cardId: card.id,
    });
  } else if (action === "scaffolded_explained") {
    const questionId = body.questionId as number | undefined;
    if (typeof questionId !== "number") {
      return NextResponse.json({ error: "questionId is required" }, { status: 400 });
    }

    const cards = await getDeckCards(deck.id);
    const card = cards[questionId];
    if (!card) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    await markCardScaffoldedExplanation({
      userId: session.user.id,
      deckId: deck.id,
      cardId: card.id,
    });
  } else if (action === "skip_known_unknown") {
    const questionId = body.questionId as number | undefined;
    if (typeof questionId !== "number") {
      return NextResponse.json({ error: "questionId is required" }, { status: 400 });
    }

    const cards = await getDeckCards(deck.id);
    const card = cards[questionId];
    if (!card) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    await applyKnownUnknownSkip({
      userId: session.user.id,
      deckId: deck.id,
      cardId: card.id,
    });
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

  let { cards, progress } = await ensureDeckProgress(session.user.id, deck.id);
  let refreshedDeck = await getDeckByFilename(deckId, session.user.id);
  let learningStage = deriveLearningStage({
    hasBeenIntroduced: Boolean(refreshedDeck?.hasBeenIntroduced),
    learningPhase: refreshedDeck?.learningPhase ?? "intro",
    cards,
    progress,
  });

  // Upgrade from scaffolded to free: persist phase and start free phase with all cards open.
  if (learningStage === "free" && refreshedDeck?.learningPhase !== "free") {
    await db.$transaction(async (tx) => {
      await tx.deck.update({
        where: { id: deck.id, ownerId: session.user.id },
        data: { learningPhase: "free" },
      });

      await tx.reviewProgress.updateMany({
        where: { userId: session.user.id, deckId: deck.id },
        data: {
          status: "new",
          nextReview: new Date(),
          reviewCount: 0,
          lastActionAt: null,
        },
      });
    });

    const refreshed = await ensureDeckProgress(session.user.id, deck.id);
    cards = refreshed.cards;
    progress = refreshed.progress;
    refreshedDeck = await getDeckByFilename(deckId, session.user.id);
    learningStage = deriveLearningStage({
      hasBeenIntroduced: Boolean(refreshedDeck?.hasBeenIntroduced),
      learningPhase: refreshedDeck?.learningPhase ?? "intro",
      cards,
      progress,
    });
  }

  const cardIdToIndex = new Map(cards.map((card, index) => [card.id, index]));

  return NextResponse.json({
    stats: toDisplayStats(learningStage, cards, progress),
    nextQuestionId: computeNextQuestionId(learningStage, cards, progress, cardIdToIndex),
    learningPhase: learningStage,
    learningStage,
  });
}
