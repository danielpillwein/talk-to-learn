import { NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import pdfParse from "pdf-parse";
import fs from "fs";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
let cachedPrompt: string | null = null;
const getSystemPrompt = () => {
  if (!cachedPrompt) {
    cachedPrompt = fs.readFileSync(
      path.join(process.cwd(), "prompts", "ai-generate.md"),
      "utf-8"
    );
  }
  return cachedPrompt;
};

const normalizeText = (input: string) =>
  input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ ]+\n/g, "\n")
    .trim();

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = String(formData.get("title") ?? "").trim();
  const topicFocus = String(formData.get("topicFocus") ?? "").trim();
  const style = String(formData.get("style") ?? "").trim();
  const difficulty = String(formData.get("difficulty") ?? "").trim();
  const count = Number(formData.get("count") ?? 0);

  if (!file || !title) {
    return NextResponse.json({ error: "file and title are required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name.toLowerCase();

  let text = "";
  if (filename.endsWith(".pdf")) {
    const data = await pdfParse(buffer);
    text = data.text ?? "";
  } else {
    text = buffer.toString("utf-8");
  }

  const normalized = normalizeText(text);
  if (!normalized) {
    return NextResponse.json({ error: "empty text" }, { status: 400 });
  }

  const systemPrompt = getSystemPrompt();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Titel: ${title}\nStil: ${style}\nSchwierigkeit: ${difficulty}\nAnzahl: ${count}\nFokus: ${topicFocus}\n\nText:\n${normalized}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const payload = completion.choices[0]?.message?.content ?? "{}";
  let parsed: { cards?: Array<{ question: string; answer: string }> } = {};
  try {
    parsed = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid AI response" }, { status: 502 });
  }

  return NextResponse.json({ cards: parsed.cards ?? [] });
}
