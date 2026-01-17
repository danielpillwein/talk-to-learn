import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export interface Question {
    id: number;
    question: string;
    modelAnswer: string;
}

export interface FileMeta {
    filename: string;
    totalQuestions: number;
}

// Cache: Dateiname -> Fragen-Array
const questionsCache: Record<string, Question[]> = {};

function getCsvPath(filename: string): string {
    // Sicherheits-Check gegen Directory Traversal
    const safeName = path.basename(filename);
    return path.join(process.cwd(), 'data', safeName);
}

function loadQuestionsForFile(filename: string): Question[] {
    if (questionsCache[filename]) {
        return questionsCache[filename];
    }

    const filePath = getCsvPath(filename);

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filename}`);
    }

    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = Papa.parse<string[]>(csvContent, {
        delimiter: ';',
        skipEmptyLines: true,
    });

    const questions = parsed.data.map((row, index) => ({
        id: index,
        question: row[0]?.trim() || '',
        modelAnswer: row[1]?.trim() || '',
    })).filter(q => q.question && q.modelAnswer);

    questionsCache[filename] = questions;
    return questions;
}

export function getAvailableFiles(): FileMeta[] {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) return [];

    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv'));

    return files.map(filename => {
        // Wir laden kurz die Fragen, um die Anzahl zu zählen (wird gecached)
        const questions = loadQuestionsForFile(filename);
        return {
            filename,
            totalQuestions: questions.length
        };
    });
}

export function getQuestions(filename: string): Question[] {
    return loadQuestionsForFile(filename);
}

export function getQuestionById(filename: string, id: number): Question | undefined {
    const questions = loadQuestionsForFile(filename);
    return questions.find((q) => q.id === id);
}