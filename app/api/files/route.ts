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
                _count: { select: { cards: true } },
            },
            where: { ownerId: session.user.id },
            orderBy: { title: 'asc' },
        });

        const grouped = await db.reviewProgress.groupBy({
            by: ['deckId', 'status'],
            where: { userId: session.user.id },
            _count: { _all: true },
        });

        const progressByDeck = grouped.reduce((acc, item) => {
            const current = acc[item.deckId] ?? { known: 0, learning: 0 };
            if (item.status === 'known') current.known += item._count._all;
            if (item.status === 'learning') current.learning += item._count._all;
            acc[item.deckId] = current;
            return acc;
        }, {} as Record<string, { known: number; learning: number }>);

        const files = decks.map((deck) => {
            const progress = progressByDeck[deck.id];
            const known = progress?.known ?? 0;
            const learning = progress?.learning ?? 0;
            const total = deck._count.cards;
            const newCards = Math.max(0, total - known - learning);

            return {
                id: deck.id,
                title: deck.title,
                filename: deck.sourceFilename,
                totalQuestions: total,
                known,
                learning,
                new: newCards,
            };
        });

        return NextResponse.json({ files });
    } catch (error) {
        console.error('Error listing files:', error);
        return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }
}
