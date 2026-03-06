import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type CardPayload = { question: string; answer: string };

function buildSourceFilename(params: { title: string; fileName: string | null }): string {
  const { title, fileName } = params;
  const baseRaw = (fileName && fileName.length > 0 ? fileName : `${title}.ai`).toLowerCase();
  const normalized = baseRaw.replace(/[^a-z0-9._-]+/g, "_");
  const dotIndex = normalized.lastIndexOf(".");
  const rawName = dotIndex > 0 ? normalized.slice(0, dotIndex) : normalized;
  const rawExt = dotIndex > 0 ? normalized.slice(dotIndex) : fileName ? ".file" : ".ai";
  const name = rawName.replace(/^_+|_+$/g, "") || "deck";
  const ext = rawExt.replace(/[^a-z0-9.]/g, "") || ".ai";
  return `${name}-${Date.now()}${ext}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const cards = (body.cards as CardPayload[] | undefined) ?? [];
  const fileName = String(body.fileName ?? "").trim();
  const hasUploadedSource = fileName.length > 0;

  if (!title || cards.length === 0) {
    return NextResponse.json({ error: "title and cards are required" }, { status: 400 });
  }

  const deck = await db.deck.create({
    data: {
      title,
      ownerId: session.user.id,
      sourceFilename: buildSourceFilename({
        title,
        fileName: hasUploadedSource ? fileName : null,
      }),
      sourceType: hasUploadedSource ? "upload" : "ai",
    },
  });

  await db.card.createMany({
    data: cards.map((card) => ({
      deckId: deck.id,
      question: String(card.question).trim(),
      answer: String(card.answer).trim(),
    })),
  });

  return NextResponse.json({ deckId: deck.id });
}
