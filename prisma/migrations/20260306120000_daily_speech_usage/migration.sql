CREATE TABLE "DailySpeechUsage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "dateKey" TEXT NOT NULL,
  "speechSeconds" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailySpeechUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DailySpeechUsage_userId_dateKey_key" ON "DailySpeechUsage"("userId", "dateKey");
CREATE INDEX "DailySpeechUsage_dateKey_idx" ON "DailySpeechUsage"("dateKey");
