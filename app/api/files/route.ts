import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(): Promise<NextResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ files: [] });
        }
        const decks = await db.deck.findMany({
            select: {
                id: true,
                title: true,
                sourceFilename: true,
                createdAt: true,
                hasBeenIntroduced: true,
                learningPhase: true,
                cards: {
                    select: {
                        question: true,
                        answer: true,
                    },
                },
                _count: { select: { cards: true } },
            },
            where: { ownerId: session.user.id },
            orderBy: { title: 'asc' },
        });

        const deckIds = decks.map((deck) => deck.id);
        const scaffoldPendingByDeck = deckIds.length
            ? await db.card.groupBy({
                  by: ['deckId'],
                  where: {
                      deckId: { in: deckIds },
                      hasScaffoldedExplanation: false,
                  },
                  _count: { _all: true },
              })
            : [];
        const seenByDeck = deckIds.length
            ? await db.card.groupBy({
                  by: ['deckId'],
                  where: {
                      deckId: { in: deckIds },
                      seen: true,
                  },
                  _count: { _all: true },
              })
            : [];

        const grouped = await db.reviewProgress.groupBy({
            by: ['deckId', 'status'],
            where: { userId: session.user.id },
            _count: { _all: true },
        });

        const lastActions = await db.reviewProgress.groupBy({
            by: ['deckId'],
            where: { userId: session.user.id, lastActionAt: { not: null } },
            _max: { lastActionAt: true },
        });

        const progressByDeck = grouped.reduce((acc, item) => {
            const current = acc[item.deckId] ?? { known: 0, learning: 0 };
            if (item.status === 'known') current.known += item._count._all;
            if (item.status === 'learning') current.learning += item._count._all;
            acc[item.deckId] = current;
            return acc;
        }, {} as Record<string, { known: number; learning: number }>);

        const lastActionByDeck = lastActions.reduce((acc, item) => {
            acc[item.deckId] = item._max.lastActionAt ?? null;
            return acc;
        }, {} as Record<string, Date | null>);

        const scaffoldPendingCountByDeck = scaffoldPendingByDeck.reduce((acc, item) => {
            acc[item.deckId] = item._count._all;
            return acc;
        }, {} as Record<string, number>);
        const seenCountByDeck = seenByDeck.reduce((acc, item) => {
            acc[item.deckId] = item._count._all;
            return acc;
        }, {} as Record<string, number>);

        const files = decks.map((deck) => {
            const progress = progressByDeck[deck.id];
            const known = progress?.known ?? 0;
            const learning = progress?.learning ?? 0;
            const total = deck._count.cards;
            const pendingScaffoldCount = scaffoldPendingCountByDeck[deck.id] ?? 0;

            const learningPhaseStatus =
                !deck.hasBeenIntroduced || deck.learningPhase === 'intro'
                    ? 'intro'
                    : deck.learningPhase === 'free'
                    ? 'free'
                    : pendingScaffoldCount > 0 || known < total
                    ? 'scaffolded'
                    : 'free';

            const introKnown = seenCountByDeck[deck.id] ?? 0;
            const effectiveKnown = learningPhaseStatus === 'intro' ? introKnown : known;
            const effectiveLearning = learningPhaseStatus === 'intro' ? 0 : learning;
            const effectiveNew = Math.max(0, total - effectiveKnown - effectiveLearning);

            return {
                id: deck.id,
                title: deck.title,
                filename: deck.sourceFilename,
                createdAt: deck.createdAt,
                totalQuestions: total,
                known: effectiveKnown,
                learning: effectiveLearning,
                new: effectiveNew,
                lastEditedAt: lastActionByDeck[deck.id] ?? deck.createdAt,
                lastLearnedAt: lastActionByDeck[deck.id] ?? deck.createdAt,
                learningPhaseStatus,
                searchText: [
                    deck.title,
                    ...deck.cards.map((card) => card.question),
                    ...deck.cards.map((card) => card.answer),
                ]
                    .join(' ')
                    .toLocaleLowerCase('de'),
                searchCards: deck.cards.map((card) => ({
                    question: card.question,
                    answer: card.answer,
                })),
            };
        });

        return NextResponse.json({ files });
    } catch (error) {
        console.error('Error listing files:', error);
        return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }
}
