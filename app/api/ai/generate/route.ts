import { NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { AI_MODELS } from "@/lib/ai/models";
import { resolvePlanForUserId, resolveQuestionCountLimitForPlan } from "@/lib/account-plans";
import {
  deriveGenerationParams,
  generateCardsFromText,
  mapCreateDeckError,
  resolveGenerationParams,
} from "@/lib/create-deck-ai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const text = String(body.text ?? "").trim();
    const topicFocus = String(body.topicFocus ?? "").trim();
    const style = String(body.style ?? "").trim();
    const difficulty = String(body.difficulty ?? "").trim();

    if (!title || !text) {
      return NextResponse.json({ error: "title and text are required" }, { status: 400 });
    }

    const session = await auth();
    const plan = await resolvePlanForUserId(session?.user?.id);
    const maxQuestionCount = resolveQuestionCountLimitForPlan(plan);

    const derived = deriveGenerationParams(text, `${title}.txt`);
    const params = resolveGenerationParams({
      derived,
      title,
      topicFocus,
      style,
      difficulty,
      count: body.count,
      maxQuestionCount,
    });

    const cards = await generateCardsFromText({
      openai,
      text,
      params,
      detectedTopics: derived.detectedTopics,
      mode: "default",
      model: AI_MODELS.GENERATION,
    });

    return NextResponse.json({ cards });
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
