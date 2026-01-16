import { NextResponse } from 'next/server';
import { getQuestions } from '@/lib/data';

export async function GET() {
    try {
        const questions = getQuestions();
        return NextResponse.json({ questions });
    } catch (error) {
        console.error('Error loading questions:', error);
        return NextResponse.json(
            { error: 'Failed to load questions' },
            { status: 500 }
        );
    }
}
