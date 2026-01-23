CREATE TABLE "Deck" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "sourceFilename" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'csv',
  "ownerId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Deck_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Deck_sourceFilename_key" ON "Deck"("sourceFilename");

CREATE TABLE "Card" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "deckId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Card_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Card_deckId_question_key" ON "Card"("deckId", "question");

CREATE TABLE "ReviewProgress" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "deckId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'new',
  "reviewCount" INTEGER NOT NULL DEFAULT 0,
  "nextReview" DATETIME,
  CONSTRAINT "ReviewProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewProgress_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewProgress_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReviewProgress_userId_cardId_key" ON "ReviewProgress"("userId", "cardId");
