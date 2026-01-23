const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

async function exportSeed() {
  const decks = await db.deck.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      cards: {
        orderBy: { createdAt: "asc" },
        select: { question: true, answer: true },
      },
    },
  });

  const seedData = decks.map((deck) => ({
    title: deck.title,
    sourceFilename: deck.sourceFilename,
    sourceType: deck.sourceType,
    cards: deck.cards,
  }));

  const outPath = path.join(__dirname, "seed-data.json");
  fs.writeFileSync(outPath, JSON.stringify(seedData, null, 2), "utf-8");
  console.log(`Exported ${seedData.length} decks to ${outPath}`);
}

exportSeed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
