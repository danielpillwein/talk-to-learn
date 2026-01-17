import { NextResponse } from 'next/server';
import { getAvailableFiles } from '@/lib/data';

export async function GET() {
    try {
        const files = getAvailableFiles();
        return NextResponse.json({ files });
    } catch (error) {
        console.error('Error listing files:', error);
        return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }
}