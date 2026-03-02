import { NextResponse } from "next/server";
import { deriveGenerationParams, extractTextFromFile, mapCreateDeckError } from "@/lib/create-deck-ai";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const { normalizedText, filename } = await extractTextFromFile(file);
    const derived = deriveGenerationParams(normalizedText, filename);

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
