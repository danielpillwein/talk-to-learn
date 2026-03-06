import { db } from "@/lib/db";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS "PublicStatsCounter" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

let ensureStoragePromise: Promise<void> | null = null;

async function ensurePublicStatsStorage(): Promise<void> {
  if (!ensureStoragePromise) {
    ensureStoragePromise = (async () => {
      await db.$executeRawUnsafe(CREATE_TABLE_SQL);
    })().catch((error) => {
      ensureStoragePromise = null;
      throw error;
    });
  }

  await ensureStoragePromise;
}

function normalizeDelta(delta: number): number {
  if (!Number.isFinite(delta)) return 0;
  const rounded = Math.round(delta);
  return Math.max(0, rounded);
}

export async function incrementPublicStat(key: string, delta = 1): Promise<void> {
  const safeKey = String(key ?? "").trim();
  const safeDelta = normalizeDelta(delta);
  if (!safeKey || safeDelta <= 0) return;

  await ensurePublicStatsStorage();

  await db.$executeRaw`
    INSERT INTO "PublicStatsCounter" ("key", "value", "updatedAt")
    VALUES (${safeKey}, ${safeDelta}, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE
    SET
      "value" = "PublicStatsCounter"."value" + excluded."value",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}

export async function getPublicStatValue(key: string): Promise<number> {
  const safeKey = String(key ?? "").trim();
  if (!safeKey) return 0;

  await ensurePublicStatsStorage();

  const rows = await db.$queryRaw<Array<{ value: number }>>`
    SELECT "value"
    FROM "PublicStatsCounter"
    WHERE "key" = ${safeKey}
    LIMIT 1
  `;

  const numeric = Number(rows[0]?.value ?? 0);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.floor(numeric);
}

export async function incrementDocumentsAnalyzedCounter(): Promise<void> {
  await incrementPublicStat("documentsAnalyzed", 1);
}

export async function getDocumentsAnalyzedCounter(): Promise<number> {
  return getPublicStatValue("documentsAnalyzed");
}
