import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
    try {
        const decks = await db.deck.findMany({
            select: {
                sourceFilename: true,
                _count: { select: { cards: true } },
            },
            orderBy: { title: 'asc' },
        });

        const files = decks.map((deck) => ({
            filename: deck.sourceFilename,
            totalQuestions: deck._count.cards,
        }));

        return NextResponse.json({ files });
    } catch (error) {
        console.error('Error listing files:', error);
        return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }
}
