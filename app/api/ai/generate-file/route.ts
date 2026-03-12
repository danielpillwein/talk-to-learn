import { NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { AI_MODELS } from "@/lib/ai/models";
import { resolvePlanForUserId, resolveQuestionCountLimitForPlan } from "@/lib/account-plans";
import {
  deriveGenerationParams,
  extractTextFromFile,
  generateCardsFromText,
  mapCreateDeckError,
  resolveGenerationParams,
} from "@/lib/create-deck-ai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const session = await auth();
    const plan = await resolvePlanForUserId(session?.user?.id);
    const maxQuestionCount = resolveQuestionCountLimitForPlan(plan);
    const file = formData.get("file") as File | null;
    const mode = String(formData.get("mode") ?? "default") === "alternate" ? "alternate" : "default";
    const { normalizedText, filename } = await extractTextFromFile(file);
    const derived = deriveGenerationParams(normalizedText, filename);
    const params = resolveGenerationParams({
      derived,
      title: String(formData.get("title") ?? ""),
      topicFocus: String(formData.get("topicFocus") ?? ""),
      style: String(formData.get("style") ?? ""),
      difficulty: String(formData.get("difficulty") ?? ""),
      count: String(formData.get("count") ?? ""),
      maxQuestionCount,
    });

    const cards = await generateCardsFromText({
      openai,
      text: normalizedText,
      params,
      detectedTopics: derived.detectedTopics,
      mode,
      model: AI_MODELS.GENERATION,
    });

    return NextResponse.json({
      cards,
      params,
      derived,
      mode,
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
