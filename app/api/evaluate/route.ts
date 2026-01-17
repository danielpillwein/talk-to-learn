import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { getQuestionById } from '@/lib/data';

export async function POST(request: Request) {
    try {
        // 1. Daten aus dem Request holen
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const questionId = formData.get('questionId') as string;

        if (!file || !questionId) {
            return NextResponse.json({ error: 'Missing file or questionId' }, { status: 400 });
        }

        // 2. Transkription mit GROQ (Whisper V3)
        // Initialisiere Groq als OpenAI-kompatiblen Client
        const groq = new OpenAI({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: 'https://api.groq.com/openai/v1', // WICHTIG: Die Groq URL
        });

        console.log('Starte Transkription mit Groq...');

        const transcription = await groq.audio.transcriptions.create({
            file: file,
            model: 'whisper-large-v3', // Das aktuell beste Modell bei Groq
            language: 'de',            // Verbessert die deutsche Erkennung massiv
            response_format: 'json',
        });

        const userAnswer = transcription.text;
        console.log("Transkript:", userAnswer);

        // 3. Daten für die Bewertung laden
        const question = getQuestionById(parseInt(questionId));

        if (!question) {
            return NextResponse.json({ error: 'Question not found' }, { status: 404 });
        }

        // 4. Bewertung mit OPENAI (GPT-4o-mini)
        // Wir nutzen hier den Standard-Client ohne baseURL Änderung
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Dein bewährter System-Prompt
        const systemPrompt = `Rolle: Wohlwollender Mathe-Tutor.
        Kontext: Audio-Transkript vs. Formale Definition.

        Regeln:
        1. VARIABLE TOLERANCE: Ignoriere Groß-/Kleinschreibung (User sagt "A", meint "a"). Phonetische Ähnlichkeit zählt.
        2. FAKTEN-CHECK: Sei milde bei ungenauen Formulierungen, aber streng bei falschen mathematischen Behauptungen.

        Anweisung für das "feedback" Feld (NATÜRLICHE SPRACHE):
        Generiere einen individuellen Satz basierend auf dem INHALT der User-Antwort:
        - Wenn der INHALT KORREKT ist: Bestätige dies kurz und motivierend.
        - Wenn der INHALT TEILWEISE RICHTIG ist: Bestätige den korrekten Teil, aber korrigiere sofort den Fehler.
        - Wenn der INHALT FALSCH ist: Sage klar, dass es nicht stimmt, und nenne kurz die richtige Lösung.

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
        console.error('Error during processing:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}