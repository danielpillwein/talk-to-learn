-- Add lastActionAt timestamp for review actions
ALTER TABLE "ReviewProgress" ADD COLUMN "lastActionAt" DATETIME;
