import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { AI_MODELS } from '@/lib/ai/models';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { loadPrompt, loadRenderedPrompt } from '@/lib/prompt-store';
import {
    normalizeSpeechSeconds,
    recordSpeechUsage,
    resolveDateKeyFromOffset,
} from '@/lib/speech-usage';

const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request): Promise<NextResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const questionId = formData.get('questionId') as string;
        const deckId = formData.get('deckId') as string;
        const evaluationModeRaw = formData.get('evaluationMode') as string | null;
        const speechSecondsRaw = formData.get('speechSeconds');
        const tzOffsetMinutesRaw = formData.get('tzOffsetMinutes');
        const evaluationMode = evaluationModeRaw === 'supportive' ? 'supportive' : 'graded';
        const speechSeconds = normalizeSpeechSeconds(speechSecondsRaw);
        const speechDateKey = resolveDateKeyFromOffset(tzOffsetMinutesRaw);

        if (!file || !questionId || !deckId) {
            return NextResponse.json({ error: 'Missing file, questionId or deckId' }, { status: 400 });
        }

        // 1. Transkription mit GROQ
        const transcription = await groq.audio.transcriptions.create({
            file: file,
            model: 'whisper-large-v3',
            language: 'de',
            response_format: 'json',
        });

        const userAnswer = transcription.text;

        // 2. Frage laden (mit deckId!)
        const deck = await db.deck.findUnique({
            where: { id: deckId, ownerId: session.user.id },
            select: { id: true },
        });

        if (!deck) {
            return NextResponse.json({ error: 'Lernset nicht gefunden' }, { status: 404 });
        }

        const questionIndex = parseInt(questionId, 10);
        if (Number.isNaN(questionIndex)) {
            return NextResponse.json({ error: 'Invalid questionId' }, { status: 400 });
        }

        const card = await db.card.findMany({
            where: { deckId: deck.id },
            orderBy: { createdAt: 'asc' },
            skip: questionIndex,
            take: 1,
            select: { question: true, answer: true },
        });

        const question = card[0];

        if (!question) {
            return NextResponse.json({ error: 'Question not found' }, { status: 404 });
        }

        if (speechSeconds > 0) {
            try {
                await recordSpeechUsage({
                    userId: session.user.id,
                    dateKey: speechDateKey,
                    speechSeconds,
                });
            } catch (speechUsageError) {
                console.error('Failed to persist speech usage:', speechUsageError);
            }
        }

        // 3. Bewertung mit OpenAI (mode-specific prompt pair)
        const promptPrefix = evaluationMode === 'supportive' ? 'evaluate-supportive' : 'evaluate-graded';
        const systemPrompt = loadPrompt(`${promptPrefix}-system`);
        const evaluationPrompt = loadRenderedPrompt(`${promptPrefix}-user`, {
            question: question.question,
            model_answer: question.answer,
            user_answer: userAnswer,
        });

        const completion = await openai.chat.completions.create({
            model: AI_MODELS.EDITING,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: evaluationPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
        });

        const result = JSON.parse(completion.choices[0].message.content || '{}');

        if (evaluationMode === 'supportive') {
            const rawRecommendation =
                typeof result.recommendation === 'string' ? result.recommendation.toLowerCase().trim() : '';
            const normalizedRecommendation =
                rawRecommendation === 'understood' || rawRecommendation === 'verstanden'
                    ? 'understood'
                    : rawRecommendation === 'review_later' ||
                      rawRecommendation === 'review' ||
                      rawRecommendation === 'später' ||
                      rawRecommendation === 'spaeter'
                    ? 'review_later'
                    : 'understood';

            return NextResponse.json({
                feedback: {
                    type: 'supportive',
                    message: result.feedback ?? 'Gute Richtung. Erklär es noch einmal mit deinen eigenen Worten.',
                    recommendation: normalizedRecommendation,
                    grading: { enabled: false },
                },
                userAnswer: userAnswer,
                modelAnswer: question.answer,
                question: question.question,
            });
        }

        return NextResponse.json({
            score: typeof result.score === 'number' ? result.score : 0,
            feedback: result.feedback ?? 'Keine Auswertung verfügbar.',
            userAnswer: userAnswer,
            modelAnswer: question.answer,
            question: question.question,
        });

    } catch (error: any) {
        console.error('Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
