import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDocumentsAnalyzedCounter } from "@/lib/public-stats";

type PublicStatsResponse = {
  usersCount: number;
  minutesExplained: number;
  decksCreated: number;
  documentsAnalyzed: number;
};

function toSafeCount(value: unknown): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.floor(numeric);
}

export async function GET(): Promise<Response> {
  const payload: PublicStatsResponse = {
    usersCount: 0,
    minutesExplained: 0,
    decksCreated: 0,
    documentsAnalyzed: 0,
  };

  try {
    payload.usersCount = toSafeCount(await db.user.count());
  } catch {
    // Keep default 0 if this metric cannot be loaded.
  }

  try {
    payload.decksCreated = toSafeCount(await db.deck.count());
  } catch {
    // Keep default 0 if this metric cannot be loaded.
  }

  try {
    payload.documentsAnalyzed = toSafeCount(await getDocumentsAnalyzedCounter());
  } catch {
    // Keep default 0 if this metric cannot be loaded.
  }

  try {
    const speechAggregate = await db.dailySpeechUsage.aggregate({
      _sum: { speechSeconds: true },
    });
    const totalSpeechSeconds = toSafeCount(speechAggregate._sum.speechSeconds);
    payload.minutesExplained = Math.floor(totalSpeechSeconds / 60);
  } catch {
    // Keep default 0 if this metric cannot be loaded.
  }

  return NextResponse.json(payload, { status: 200 });
}
