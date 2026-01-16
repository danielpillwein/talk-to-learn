import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getQuestionById } from '@/lib/data';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const audioFile = formData.get('file') as File;
        const questionId = formData.get('questionId') as string;

        if (!audioFile || !questionId) {
            return NextResponse.json(
                { error: 'Missing file or questionId' },
                { status: 400 }
            );
        }

        // Step A: Transcribe audio with Whisper
        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            language: 'de',
        });

        const userAnswer = transcription.text;

        // Step B: Get question and model answer
        const question = getQuestionById(parseInt(questionId));

        if (!question) {
            return NextResponse.json(
                { error: 'Question not found' },
                { status: 404 }
            );
        }

        // Step C: Evaluate with GPT-4o-mini
        const evaluationPrompt = `Frage: ${question.question}
Musterantwort: ${question.modelAnswer}
User-Antwort: ${userAnswer}

Bewerte hart aber fair auf Inhalt. Output JSON only: { "score": number (0-10), "feedback": string (max 1 Satz) }.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content:
                        'Du bist ein strenger aber fairer Prüfer. Bewerte die Antworten präzise und gib konstruktives Feedback.',
                },
                {
                    role: 'user',
                    content: evaluationPrompt,
                },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
        });

        const result = JSON.parse(completion.choices[0].message.content || '{}');

        return NextResponse.json({
            score: result.score,
            feedback: result.feedback,
            userAnswer,
            modelAnswer: question.modelAnswer,
            question: question.question,
        });
    } catch (error) {
        console.error('Error evaluating answer:', error);
        return NextResponse.json(
            { error: 'Failed to evaluate answer' },
            { status: 500 }
        );
    }
}
