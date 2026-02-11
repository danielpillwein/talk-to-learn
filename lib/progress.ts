import { db } from "./db";

export type ReviewOutcome = "known" | "review" | "wrong";
export type DeckLearningPhase = "intro" | "scaffolded";
export type DeckLearningStage = "intro" | "scaffolded" | "free";
export type CardLearningState =
  | "unseen"
  | "explained_with_help"
  | "explained_freely"
  | "skipped_known_unknown";

const REVIEW_WINDOWS = {
  known: 365 * 24 * 60 * 60 * 1000,
  review: 10 * 60 * 1000,
  wrong: 2 * 60 * 1000,
  skip_known_unknown: 2 * 60 * 1000,
};

export async function getDeckByFilename(id: string, ownerId?: string) {
  return db.deck.findUnique({
    where: { id, ...(ownerId ? { ownerId } : {}) },
    select: {
      id: true,
      title: true,
      hasBeenIntroduced: true,
      learningPhase: true,
    },
  });
}

export async function getDeckCards(deckId: string) {
  return db.card.findMany({
    where: { deckId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      seen: true,
      hasScaffoldedExplanation: true,
      state: true,
    },
  });
}

export async function ensureDeckProgress(userId: string, deckId: string) {
  const cards = await getDeckCards(deckId);
  if (cards.length === 0) {
    return { cards, progress: [] };
  }

  const cardIds = cards.map((card) => card.id);
  const existing = await db.reviewProgress.findMany({
    where: { userId, cardId: { in: cardIds } },
    select: { cardId: true, status: true, nextReview: true, reviewCount: true },
  });

  const existingMap = new Map(existing.map((item) => [item.cardId, item]));
  const missing = cardIds
    .filter((cardId) => !existingMap.has(cardId))
    .map((cardId) => ({
      userId,
      deckId,
      cardId,
      status: "new",
      nextReview: new Date(),
      reviewCount: 0,
    }));

  if (missing.length > 0) {
    await db.reviewProgress.createMany({ data: missing });
    missing.forEach((item) => {
      existingMap.set(item.cardId, {
        cardId: item.cardId,
        status: item.status,
        nextReview: item.nextReview,
        reviewCount: item.reviewCount,
      });
    });
  }

  return {
    cards,
    progress: cards.map((card) => existingMap.get(card.id)!),
  };
}

export function computeStats(progress: Array<{ status: string }>, total: number) {
  let known = 0;
  let learning = 0;

  for (const item of progress) {
    if (item.status === "known") known++;
    if (item.status === "learning") learning++;
  }

  const newCount = Math.max(0, total - known - learning);
  return { known, learning, new: newCount };
}

export function computeNextQuestionId(
  learningStage: DeckLearningStage,
  cards: Array<{ id: string; seen: boolean; hasScaffoldedExplanation: boolean }>,
  progress: Array<{ cardId: string; status: string; nextReview: Date | null }>,
  cardIdToIndex: Map<string, number>
) {
  if (learningStage === "intro") {
    const nextUnseen = cards.find((card) => !card.seen);
    return nextUnseen ? (cardIdToIndex.get(nextUnseen.id) ?? null) : null;
  }

  if (learningStage === "scaffolded") {
    // In scaffolded stage, finish every card once before free explanation starts.
    const needsScaffold = cards.find((card) => !card.hasScaffoldedExplanation);
    if (needsScaffold) {
      return cardIdToIndex.get(needsScaffold.id) ?? null;
    }
  }

  const now = Date.now();

  const due = progress
    .filter((item) => item.status === "learning" && item.nextReview && item.nextReview.getTime() <= now)
    .sort((a, b) => a.nextReview!.getTime() - b.nextReview!.getTime());

  if (due.length > 0) {
    return cardIdToIndex.get(due[0].cardId) ?? null;
  }

  const newCards = progress.filter((item) => item.status === "new");
  if (newCards.length > 0) {
    const pick = newCards[Math.floor(Math.random() * newCards.length)];
    return cardIdToIndex.get(pick.cardId) ?? null;
  }

  // If nothing is open/new, keep showing learning/review cards
  // even when their nextReview is in the future.
  const learningCards = progress
    .filter((item) => item.status === "learning")
    .sort((a, b) => {
      const aTime = a.nextReview?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.nextReview?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  if (learningCards.length > 0) {
    return cardIdToIndex.get(learningCards[0].cardId) ?? null;
  }

  return null;
}

export function deriveLearningStage({
  hasBeenIntroduced,
  learningPhase,
  cards,
  progress,
}: {
  hasBeenIntroduced: boolean;
  learningPhase: string;
  cards: Array<{ hasScaffoldedExplanation: boolean }>;
  progress: Array<{ status: string }>;
}): DeckLearningStage {
  if (!hasBeenIntroduced || learningPhase === "intro") {
    return "intro";
  }

  if (learningPhase === "free") {
    return "free";
  }

  const hasPendingScaffold = cards.some((card) => !card.hasScaffoldedExplanation);
  if (hasPendingScaffold) {
    return "scaffolded";
  }

  const allKnown = progress.length > 0 && progress.every((item) => item.status === "known");
  return allKnown ? "free" : "scaffolded";
}

export async function markCardSeenAndAdvanceDeck({
  userId,
  deckId,
  cardId,
}: {
  userId: string;
  deckId: string;
  cardId: string;
}) {
  await db.card.update({
    where: { id: cardId },
    data: {
      seen: true,
      state: "unseen",
    },
  });

  const unseenCount = await db.card.count({
    where: { deckId, seen: false },
  });

  if (unseenCount === 0) {
    await db.deck.update({
      where: { id: deckId, ownerId: userId },
      data: {
        hasBeenIntroduced: true,
        learningPhase: "scaffolded",
      },
    });
  }
}

export async function markCardScaffoldedExplanation({
  cardId,
}: {
  cardId: string;
}) {
  await db.card.update({
    where: { id: cardId },
    data: {
      seen: true,
      hasScaffoldedExplanation: true,
      state: "explained_with_help",
    },
  });
}

export async function applyReviewOutcome({
  userId,
  deckId,
  cardId,
  outcome,
}: {
  userId: string;
  deckId: string;
  cardId: string;
  outcome: ReviewOutcome;
}) {
  const nextReview = new Date(Date.now() + REVIEW_WINDOWS[outcome]);
  const status = outcome === "known" ? "known" : "learning";

  await db.$transaction(async (tx) => {
    await tx.reviewProgress.upsert({
      where: { userId_cardId: { userId, cardId } },
      create: {
        userId,
        deckId,
        cardId,
        status,
        nextReview,
        reviewCount: 1,
        lastActionAt: new Date(),
      },
      update: {
        status,
        nextReview,
        reviewCount: { increment: 1 },
        lastActionAt: new Date(),
      },
    });

    await tx.card.update({
      where: { id: cardId },
      data: {
        seen: true,
        hasScaffoldedExplanation: true,
        state: "explained_freely",
      },
    });
  });
}

export async function applyKnownUnknownSkip({
  userId,
  deckId,
  cardId,
}: {
  userId: string;
  deckId: string;
  cardId: string;
}) {
  const nextReview = new Date(Date.now() + REVIEW_WINDOWS.skip_known_unknown);

  await db.$transaction(async (tx) => {
    await tx.reviewProgress.upsert({
      where: { userId_cardId: { userId, cardId } },
      create: {
        userId,
        deckId,
        cardId,
        status: "learning",
        nextReview,
        reviewCount: 1,
        lastActionAt: new Date(),
      },
      update: {
        status: "learning",
        nextReview,
        reviewCount: { increment: 1 },
        lastActionAt: new Date(),
      },
    });

    await tx.card.update({
      where: { id: cardId },
      data: {
        seen: true,
        hasScaffoldedExplanation: true,
        state: "skipped_known_unknown",
      },
    });
  });
}

export async function resetDeckProgress(userId: string, deckId: string) {
  await db.reviewProgress.deleteMany({ where: { userId, deckId } });
}
