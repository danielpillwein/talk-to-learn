import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { deriveLearningStage, ensureDeckProgress } from '@/lib/progress';

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const searchParams = request.nextUrl.searchParams;
        const deckId = searchParams.get('deckId');

        if (!deckId) {
            return NextResponse.json({ error: 'deckId is required' }, { status: 400 });
        }

        const deck = await db.deck.findUnique({
            where: { id: deckId, ownerId: session.user.id },
            select: { id: true, title: true, hasBeenIntroduced: true, learningPhase: true },
        });

        if (!deck) {
            return NextResponse.json({ error: 'Lernset nicht gefunden' }, { status: 404 });
        }

        const cards = await db.card.findMany({
            where: { deckId: deck.id },
            orderBy: { createdAt: 'asc' },
            select: {
                question: true,
                answer: true,
                seen: true,
                hasScaffoldedExplanation: true,
                state: true,
            },
        });

        const questions = cards.map((card, index) => ({
            id: index,
            question: card.question,
            modelAnswer: card.answer,
            seen: card.seen,
            hasScaffoldedExplanation: card.hasScaffoldedExplanation,
            state: card.state,
        }));

        const { progress } = await ensureDeckProgress(session.user.id, deck.id);

        return NextResponse.json({
            questions,
            deckTitle: deck.title,
            deckLearningPhase: deriveLearningStage({
                hasBeenIntroduced: deck.hasBeenIntroduced,
                learningPhase: deck.learningPhase,
                cards: questions,
                progress,
            }),
        });
    } catch (error) {
        console.error('Error loading questions:', error);
        return NextResponse.json(
            { error: 'Failed to load questions' },
            { status: 500 }
        );
    }
}
