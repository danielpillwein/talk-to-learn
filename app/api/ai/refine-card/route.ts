import { NextResponse } from "next/server";
import OpenAI from "openai";
import { CreateDeckError, mapCreateDeckError } from "@/lib/create-deck-ai";
import { loadPrompt, loadRenderedPrompt } from "@/lib/prompt-store";

type RefineAction = "expandAnswer" | "condenseAnswer";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const question = String(body.question ?? "").trim();
    const answer = String(body.answer ?? "").trim();
    const action = String(body.action ?? "").trim() as RefineAction;
    const title = String(body.title ?? "").trim();
    const style = String(body.style ?? "").trim();
    const difficulty = String(body.difficulty ?? "").trim();
    const topicFocus = String(body.topicFocus ?? "").trim();

    if (!question || !answer) {
      throw new CreateDeckError({
        code: "INVALID_REQUEST",
        status: 400,
        retryable: false,
        message: "Frage und Antwort fehlen.",
      });
    }

    if (!["expandAnswer", "condenseAnswer"].includes(action)) {
      throw new CreateDeckError({
        code: "INVALID_REQUEST",
        status: 400,
        retryable: false,
        message: "Ungültige Verfeinerungsaktion.",
      });
    }

    const systemPrompt = loadPrompt("refine-card-system");
    const userPrompt = loadRenderedPrompt("refine-card-user", {
      title: title || "Lernset",
      style: style || "kompakt",
      difficulty: difficulty || "mittel",
      topic_focus: topicFocus || "-",
      action,
      question,
      answer,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: action === "expandAnswer" ? 0.3 : 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { question?: string; answer?: string };
    const refinedQuestion = String(parsed.question ?? "").trim();
    const refinedAnswer = String(parsed.answer ?? "").trim();

    if (!refinedQuestion || !refinedAnswer) {
      throw new CreateDeckError({
        code: "AI_RESPONSE_INVALID",
        status: 502,
        retryable: true,
        message: "Die KI-Antwort war unvollständig. Bitte erneut versuchen.",
      });
    }

    return NextResponse.json({
      card: {
        question: refinedQuestion,
        answer: refinedAnswer,
      },
    });
  } catch (error) {
    const mapped = mapCreateDeckError(error);
    return NextResponse.json(
      {
        error: {
          code: mapped.code,
          message: mapped.message,
          retryable: mapped.retryable,
        },
      },
      { status: mapped.status }
    );
  }
}
