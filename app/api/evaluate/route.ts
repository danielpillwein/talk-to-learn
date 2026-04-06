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

function clampInt(value: unknown, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return min;
    const rounded = Math.round(value);
    return Math.max(min, Math.min(max, rounded));
}

function normalizeRecommendation(raw: unknown, score: number): 'understood' | 'review_later' {
    const value = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
    if (value === 'review_later' || value === 'review' || value === 'später' || value === 'spaeter') {
        return 'review_later';
    }
    if (value === 'understood' || value === 'verstanden') {
        return score >= 7 ? 'understood' : 'review_later';
    }
    return score >= 7 ? 'understood' : 'review_later';
}

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
            const offTopic = Boolean(result.off_topic);
            const content = clampInt(result.content, 0, 4);
            const completeness = clampInt(result.completeness, 0, 3);
            const understanding = clampInt(result.understanding, 0, 2);
            const clarity = clampInt(result.clarity, 0, 1);

            const rubricScore = content + completeness + understanding + clarity;
            const parsedModelScore = clampInt(result.score, 0, 10);
            const hasRubric =
                typeof result.content === 'number' ||
                typeof result.completeness === 'number' ||
                typeof result.understanding === 'number' ||
                typeof result.clarity === 'number';
            const preliminaryScore = hasRubric ? rubricScore : parsedModelScore;
            const finalScore = offTopic ? Math.min(1, preliminaryScore) : preliminaryScore;
            const normalizedRecommendation = normalizeRecommendation(result.recommendation, finalScore);

            const shortFeedback =
                typeof result.short_feedback === 'string' && result.short_feedback.trim().length > 0
                    ? result.short_feedback.trim()
                    : typeof result.feedback === 'string' && result.feedback.trim().length > 0
                    ? result.feedback.trim()
                    : finalScore >= 7
                    ? 'Die Kernidee ist korrekt, aber ein wichtiger Punkt fehlt noch.'
                    : 'Die Antwort passt noch nicht präzise zur Frage.';

            const improvement =
                typeof result.improvement === 'string' && result.improvement.trim().length > 0
                    ? result.improvement.trim()
                    : offTopic
                    ? 'Beantworte direkt den Kernbegriff der Frage und nenne einen klaren Unterschied.'
                    : 'Ergänze genau den fehlenden Kernpunkt und formuliere ihn in einem klaren Satz.';

            return NextResponse.json({
                feedback: {
                    type: 'supportive',
                    shortFeedback,
                    improvement,
                    score: finalScore,
                    content,
                    completeness,
                    understanding,
                    clarity,
                    recommendation: normalizedRecommendation,
                    grading: { enabled: true },
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
