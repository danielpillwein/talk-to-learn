import { NextRequest, NextResponse } from 'next/server';
import { getQuestions } from '@/lib/data';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const filename = searchParams.get('file');

        if (!filename) {
            return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
        }

        const questions = getQuestions(filename);
        return NextResponse.json({ questions });
    } catch (error) {
        console.error('Error loading questions:', error);
        return NextResponse.json(
            { error: 'Failed to load questions' },
            { status: 500 }
        );
    }
}