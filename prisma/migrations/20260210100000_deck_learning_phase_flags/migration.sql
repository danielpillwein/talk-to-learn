-- Add deck-level learning flow flags
ALTER TABLE "Deck" ADD COLUMN "hasBeenIntroduced" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Deck" ADD COLUMN "learningPhase" TEXT NOT NULL DEFAULT 'intro';
