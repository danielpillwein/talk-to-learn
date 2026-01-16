import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export interface Question {
    id: number;
    question: string;
    modelAnswer: string;
}

let questionsCache: Question[] | null = null;

function loadQuestions(): Question[] {
    if (questionsCache) {
        return questionsCache;
    }

    const csvPath = path.join(process.cwd(), 'data', 'Anki_Übungstest_2.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    const parsed = Papa.parse<string[]>(csvContent, {
        delimiter: ';',
        skipEmptyLines: true,
    });

    questionsCache = parsed.data.map((row, index) => ({
        id: index,
        question: row[0]?.trim() || '',
        modelAnswer: row[1]?.trim() || '',
    }));

    return questionsCache;
}

export function getQuestions(): Question[] {
    return loadQuestions();
}

export function getQuestionById(id: number): Question | undefined {
    const questions = loadQuestions();
    return questions.find((q) => q.id === id);
}
