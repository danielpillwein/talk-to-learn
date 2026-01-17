import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { getQuestionById } from '@/lib/data';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const questionId = formData.get('questionId') as string;
        // NEU: Filename auslesen
        const filename = formData.get('filename') as string;

        if (!file || !questionId || !filename) {
            return NextResponse.json({ error: 'Missing file, questionId or filename' }, { status: 400 });
        }

        // 1. Transkription mit GROQ
        const groq = new OpenAI({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: 'https://api.groq.com/openai/v1',
        });

        const transcription = await groq.audio.transcriptions.create({
            file: file,
            model: 'whisper-large-v3',
            language: 'de',
            response_format: 'json',
        });

        const userAnswer = transcription.text;

        // 2. Frage laden (mit filename!)
        const question = getQuestionById(filename, parseInt(questionId));

        if (!question) {
            return NextResponse.json({ error: 'Question not found' }, { status: 404 });
        }

        // 3. Bewertung mit OpenAI
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const systemPrompt = `Rolle: Wohlwollender Mathe-Tutor.
        Kontext: Audio-Transkript vs. Formale Definition.
        Regeln:
        1. VARIABLE TOLERANCE: Ignoriere Groß-/Kleinschreibung. Phonetische Ähnlichkeit zählt.
        2. FAKTEN-CHECK: Sei milde bei ungenauen Formulierungen, aber streng bei falschen mathematischen Behauptungen.
        Anweisung für das "feedback" Feld (NATÜRLICHE SPRACHE):
        - INHALT KORREKT: Bestätige kurz und motivierend.
        - TEILWEISE RICHTIG: Bestätige das Richtige, korrigiere den Fehler.
        - FALSCH: Sage klar, dass es nicht stimmt und nenne die Lösung.
        Output JSON: { "score": 0-10, "feedback": "Max 1-2 kurze Sätze auf Deutsch." }`;

        const evaluationPrompt = `Frage: ${question.question}
        Muster: ${question.modelAnswer}
        User: ${userAnswer}`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: evaluationPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
        });

        const result = JSON.parse(completion.choices[0].message.content || '{}');

        return NextResponse.json({
            score: result.score,
            feedback: result.feedback,
            userAnswer: userAnswer,
            modelAnswer: question.modelAnswer,
            question: question.question
        });

    } catch (error: any) {
        console.error('Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}