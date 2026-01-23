import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const filename = searchParams.get('file');

        if (!filename) {
            return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
        }

        const deck = await db.deck.findUnique({
            where: { sourceFilename: filename },
            select: { id: true },
        });

        if (!deck) {
            return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
        }

        const cards = await db.card.findMany({
            where: { deckId: deck.id },
            orderBy: { createdAt: 'asc' },
            select: { question: true, answer: true },
        });

        const questions = cards.map((card, index) => ({
            id: index,
            question: card.question,
            modelAnswer: card.answer,
        }));

        return NextResponse.json({ questions });
    } catch (error) {
        console.error('Error loading questions:', error);
        return NextResponse.json(
            { error: 'Failed to load questions' },
            { status: 500 }
        );
    }
}
