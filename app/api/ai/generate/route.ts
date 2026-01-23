import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const text = String(body.text ?? "").trim();
  const topicFocus = String(body.topicFocus ?? "").trim();
  const style = String(body.style ?? "").trim();
  const difficulty = String(body.difficulty ?? "").trim();
  const count = Number(body.count ?? 0);

  if (!title || !text) {
    return NextResponse.json({ error: "title and text are required" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = fs.readFileSync(
    path.join(process.cwd(), "prompts", "ai-generate.md"),
    "utf-8"
  );

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Titel: ${title}\nStil: ${style}\nSchwierigkeit: ${difficulty}\nAnzahl: ${count}\nFokus: ${topicFocus}\n\nText:\n${text}`,
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
