import { db } from "./db";

export type ReviewOutcome = "known" | "review" | "wrong";

const REVIEW_WINDOWS = {
  known: 365 * 24 * 60 * 60 * 1000,
  review: 10 * 60 * 1000,
  wrong: 2 * 60 * 1000,
};

export async function getDeckByFilename(id: string, ownerId?: string) {
  return db.deck.findUnique({
    where: { id, ...(ownerId ? { ownerId } : {}) },
    select: { id: true, title: true },
  });
}

export async function getDeckCards(deckId: string) {
  return db.card.findMany({
    where: { deckId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
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
  progress: Array<{ cardId: string; status: string; nextReview: Date }>,
  cardIdToIndex: Map<string, number>
) {
  const now = Date.now();

  const due = progress
    .filter((item) => item.status === "learning" && item.nextReview.getTime() <= now)
    .sort((a, b) => a.nextReview.getTime() - b.nextReview.getTime());

  if (due.length > 0) {
    return cardIdToIndex.get(due[0].cardId) ?? null;
  }

  const newCards = progress.filter((item) => item.status === "new");
  if (newCards.length > 0) {
    const pick = newCards[Math.floor(Math.random() * newCards.length)];
    return cardIdToIndex.get(pick.cardId) ?? null;
  }

  return null;
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

  await db.reviewProgress.upsert({
    where: { userId_cardId: { userId, cardId } },
    create: {
      userId,
      deckId,
      cardId,
      status,
      nextReview,
      reviewCount: 1,
    },
    update: {
      status,
      nextReview,
      reviewCount: { increment: 1 },
    },
  });
}

export async function resetDeckProgress(userId: string, deckId: string) {
  await db.reviewProgress.deleteMany({ where: { userId, deckId } });
}
