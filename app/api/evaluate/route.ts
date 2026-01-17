import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getQuestionById } from '@/lib/data';



export async function POST(request: NextRequest) {

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

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
        // Sparsamer, aber präziser Prompt
        // Prompt Update: Tolerant bei Sprache, streng bei falschen Fakten
        // Prompt Update: Toleranz bei Variablen, weichere Bewertung, fixes Feedback-Format
        // Prompt Update: Dynamisches, inhaltliches Feedback (keine Textbausteine)
        const systemPrompt = `Rolle: Wohlwollender Mathe-Tutor.
        Kontext: Audio-Transkript vs. Formale Definition.

        Regeln:
        1. VARIABLE TOLERANCE: Ignoriere Groß-/Kleinschreibung (User sagt "A", meint "a"). Phonetische Ähnlichkeit zählt.
        2. FAKTEN-CHECK: Sei milde bei ungenauen Formulierungen, aber streng bei falschen mathematischen Behauptungen.

        Anweisung für das "feedback" Feld (NATÜRLICHE SPRACHE):
        Generiere einen individuellen Satz basierend auf dem INHALT der User-Antwort:
        - Wenn der INHALT KORREKT ist: Bestätige dies kurz und motivierend (z.B. "Gute Erklärung", "Das trifft den Kern", "Absolut richtig"). Variiere den Wortlaut.
        - Wenn der INHALT TEILWEISE RICHTIG ist: Bestätige den korrekten Teil, aber korrigiere sofort den Fehler (z.B. "Der erste Teil stimmt, aber es muss [Korrektur] heißen").
        - Wenn der INHALT FALSCH ist: Sage klar, dass es nicht stimmt, und nenne kurz die richtige Lösung.

        Output JSON: { "score": 0-10, "feedback": "Max 1-2 kurze Sätze auf Deutsch." }`;

        const evaluationPrompt = `Frage: ${question.question}
        Muster: ${question.modelAnswer}
        User: ${userAnswer}`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                {
                    role: 'user',
                    content: evaluationPrompt,
                },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3, // Leicht erhöht, damit er bei Umschreibungen flexibler ist
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
