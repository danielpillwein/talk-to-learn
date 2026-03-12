import { NextResponse } from "next/server";
import OpenAI from "openai";
import { AI_MODELS } from "@/lib/ai/models";
import {
  deriveGenerationParamsWithAiTitle,
  extractTextFromFile,
  mapCreateDeckError,
} from "@/lib/create-deck-ai";
import { incrementDocumentsAnalyzedCounter } from "@/lib/public-stats";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const { normalizedText, filename } = await extractTextFromFile(file);
    const derived = await deriveGenerationParamsWithAiTitle({
      openai,
      text: normalizedText,
      filename,
      model: AI_MODELS.GENERATION,
    });

    // Count document analysis directly after a successful upload/derive step.
    try {
      await incrementDocumentsAnalyzedCounter();
    } catch {
      // Never block user flow if telemetry counter write fails.
    }

    return NextResponse.json({
      suggestedTitle: derived.suggestedTitle,
      suggestedDifficulty: derived.suggestedDifficulty,
      suggestedQuestionCount: derived.suggestedQuestionCount,
      suggestedStyle: derived.suggestedStyle,
      detectedTopics: derived.detectedTopics,
      stats: derived.stats,
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
