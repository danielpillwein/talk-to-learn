-- Add card-level state for intro/scaffolded/free explanation flow
ALTER TABLE "Card" ADD COLUMN "seen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Card" ADD COLUMN "hasScaffoldedExplanation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Card" ADD COLUMN "state" TEXT NOT NULL DEFAULT 'unseen';
