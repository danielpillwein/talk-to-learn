import { NextResponse } from "next/server";
import OpenAI from "openai";
import { loadPrompt, loadRenderedPrompt } from "@/lib/prompt-store";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request): Promise<NextResponse> {
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

  const systemPrompt = loadPrompt("ai-generate");
  const modeHint = loadRenderedPrompt("ai-generate-mode", { mode: "default" }).trim();
  const userPrompt = loadRenderedPrompt("ai-generate-user", {
    title,
    style: style || "kompakt",
    difficulty: difficulty || "mittel",
    count: Number.isFinite(count) && count > 0 ? count : 8,
    detected_topics: topicFocus || "keine",
    topic_focus: topicFocus || "keiner",
    mode_hint: modeHint,
    text,
  });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: userPrompt,
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
