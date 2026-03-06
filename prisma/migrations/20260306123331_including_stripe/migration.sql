-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailySpeechUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "speechSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailySpeechUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DailySpeechUsage" ("createdAt", "dateKey", "id", "speechSeconds", "updatedAt", "userId") SELECT "createdAt", "dateKey", "id", "speechSeconds", "updatedAt", "userId" FROM "DailySpeechUsage";
DROP TABLE "DailySpeechUsage";
ALTER TABLE "new_DailySpeechUsage" RENAME TO "DailySpeechUsage";
CREATE INDEX "DailySpeechUsage_dateKey_idx" ON "DailySpeechUsage"("dateKey");
CREATE UNIQUE INDEX "DailySpeechUsage_userId_dateKey_key" ON "DailySpeechUsage"("userId", "dateKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
