import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS "DailySpeechUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "speechSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailySpeechUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )
`;

const CREATE_UNIQUE_INDEX_SQL =
  'CREATE UNIQUE INDEX IF NOT EXISTS "DailySpeechUsage_userId_dateKey_key" ON "DailySpeechUsage"("userId", "dateKey")';

const CREATE_DATE_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS "DailySpeechUsage_dateKey_idx" ON "DailySpeechUsage"("dateKey")';

let ensureStoragePromise: Promise<void> | null = null;

async function ensureSpeechUsageStorage(): Promise<void> {
  if (!ensureStoragePromise) {
    ensureStoragePromise = (async () => {
      await db.$executeRawUnsafe(CREATE_TABLE_SQL);
      await db.$executeRawUnsafe(CREATE_UNIQUE_INDEX_SQL);
      await db.$executeRawUnsafe(CREATE_DATE_INDEX_SQL);
    })().catch((error) => {
      ensureStoragePromise = null;
      throw error;
    });
  }

  await ensureStoragePromise;
}

export function normalizeTimezoneOffset(rawOffset: unknown): number {
  const parsed = Number(rawOffset);
  if (!Number.isFinite(parsed)) return 0;
  const normalized = Math.trunc(parsed);
  return Math.min(840, Math.max(-840, normalized));
}

export function resolveDateKeyFromOffset(rawOffset: unknown, now: Date = new Date()): string {
  const offsetMinutes = normalizeTimezoneOffset(rawOffset);
  const localTimeMs = now.getTime() - offsetMinutes * 60_000;
  const localDate = new Date(localTimeMs);

  const year = localDate.getUTCFullYear();
  const month = String(localDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(localDate.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function normalizeSpeechSeconds(rawSeconds: unknown): number {
  const parsed = Number(rawSeconds);
  if (!Number.isFinite(parsed)) return 0;
  const rounded = Math.round(parsed);
  return Math.max(0, Math.min(3600, rounded));
}

export async function recordSpeechUsage(params: {
  userId: string;
  dateKey: string;
  speechSeconds: number;
}): Promise<void> {
  const { userId, dateKey, speechSeconds } = params;
  const normalizedSeconds = normalizeSpeechSeconds(speechSeconds);

  if (!userId || !dateKey || normalizedSeconds <= 0) {
    return;
  }

  await ensureSpeechUsageStorage();

  await db.$executeRaw`
    INSERT INTO "DailySpeechUsage" (
      "id",
      "userId",
      "dateKey",
      "speechSeconds",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${userId},
      ${dateKey},
      ${normalizedSeconds},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("userId", "dateKey") DO UPDATE
    SET
      "speechSeconds" = "DailySpeechUsage"."speechSeconds" + excluded."speechSeconds",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}

export async function getSpeechUsageSeconds(params: {
  userId: string;
  dateKey: string;
}): Promise<number> {
  const { userId, dateKey } = params;

  if (!userId || !dateKey) {
    return 0;
  }

  await ensureSpeechUsageStorage();

  const rows = await db.$queryRaw<Array<{ speechSeconds: number }>>`
    SELECT "speechSeconds"
    FROM "DailySpeechUsage"
    WHERE "userId" = ${userId} AND "dateKey" = ${dateKey}
    LIMIT 1
  `;

  const value = Number(rows[0]?.speechSeconds ?? 0);
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}
