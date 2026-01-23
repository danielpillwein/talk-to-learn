const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

const path = require("path");
const fs = require("fs");

const seedPath = path.join(__dirname, "seed-data.json");
const seedData = JSON.parse(fs.readFileSync(seedPath, "utf-8"));

async function seedDev() {
  if (process.env.NODE_ENV && process.env.NODE_ENV !== "development") {
    console.log("Skipping seed: not in development.");
    return;
  }

  const existingDecks = await db.deck.count();
  if (existingDecks > 0) {
    console.log("Seed skipped: decks already exist.");
    return;
  }

  for (const deck of seedData) {
    const createdDeck = await db.deck.create({
      data: {
        title: deck.title,
        sourceFilename: deck.sourceFilename ?? `${deck.title.toLowerCase().replace(/\s+/g, "_")}.seed`,
        sourceType: deck.sourceType ?? "seed",
      },
    });

    await db.card.createMany({
      data: deck.cards.map((card) => ({
        deckId: createdDeck.id,
        question: card.question,
        answer: card.answer,
      })),
    });
  }

  console.log("Seed completed.");
}

seedDev()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
