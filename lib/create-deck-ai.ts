import OpenAI from "openai";
import pdfParse from "pdf-parse";
import { loadPrompt, loadRenderedPrompt } from "@/lib/prompt-store";
import { billing } from "@/src/config/billing";

export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md"];
const MIN_QUESTION_COUNT = 2;
const PREMIUM_MAX_QUESTIONS =
  typeof billing.plans.premium.maxQuestionsPerDeck === "number"
    ? billing.plans.premium.maxQuestionsPerDeck
    : MIN_QUESTION_COUNT;
const MAX_QUESTION_COUNT = Math.max(MIN_QUESTION_COUNT, PREMIUM_MAX_QUESTIONS);

export type DifficultyOption = "leicht" | "mittel" | "anspruchsvoll";
export type StyleOption = "erklärend" | "pruefungsnah" | "kompakt";
export type GenerationMode = "default" | "alternate";

export type CardPayload = {
  question: string;
  answer: string;
};

export type DerivedGenerationParams = {
  suggestedTitle: string;
  suggestedDifficulty: DifficultyOption;
  suggestedQuestionCount: number;
  suggestedStyle: StyleOption;
  detectedTopics: string[];
  stats: {
    wordCount: number;
    headingDensity: number;
    averageSentenceLength: number;
  };
};

export type ResolvedGenerationParams = {
  title: string;
  difficulty: DifficultyOption;
  count: number;
  style: StyleOption;
  topicFocus: string;
};

export type CreateDeckErrorCode =
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "PARSING_ERROR"
  | "EMPTY_DOCUMENT"
  | "AI_TIMEOUT"
  | "AI_RESPONSE_INVALID"
  | "AI_GENERATION_FAILED"
  | "INVALID_REQUEST";

export class CreateDeckError extends Error {
  code: CreateDeckErrorCode;
  status: number;
  retryable: boolean;

  constructor(options: {
    code: CreateDeckErrorCode;
    message: string;
    status: number;
    retryable: boolean;
  }) {
    super(options.message);
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable;
  }
}

const STOP_WORDS = new Set([
  "aber",
  "alle",
  "also",
  "als",
  "am",
  "an",
  "and",
  "auf",
  "aus",
  "bei",
  "bin",
  "bist",
  "das",
  "dass",
  "dein",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "dies",
  "doch",
  "du",
  "ein",
  "eine",
  "einer",
  "eines",
  "er",
  "es",
  "for",
  "from",
  "hat",
  "have",
  "ich",
  "ihr",
  "im",
  "in",
  "ist",
  "it",
  "mit",
  "nach",
  "nicht",
  "oder",
  "of",
  "on",
  "sich",
  "sie",
  "sind",
  "so",
  "the",
  "to",
  "und",
  "von",
  "was",
  "wie",
  "wir",
  "you",
  "zu",
  "zur",
]);

function getExtension(filename: string): string {
  const lower = filename.toLowerCase();
  const idx = lower.lastIndexOf(".");
  if (idx < 0) return "";
  return lower.slice(idx);
}

function normalizeText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ ]+\n/g, "\n")
    .trim();
}

function titleFromFilename(filename: string): string {
  const extension = getExtension(filename);
  const raw = extension ? filename.slice(0, -extension.length) : filename;
  const cleaned = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function fallbackTitle(filename: string, now = new Date()): string {
  const fromName = titleFromFilename(filename);
  if (fromName) return fromName;
  const isoDate = now.toISOString().slice(0, 10);
  return `Lernset - ${isoDate}`;
}

function getLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function toTitleWord(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function normalizeTitleCandidate(input: string): string {
  return input
    .replace(/^#+\s*/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.:!?]+$/, "")
    .trim();
}

function isGenericTitle(input: string): boolean {
  const value = input.toLowerCase();
  if (!value) return true;
  if (value.length < 6) return true;
  return /^(dokument|unterlagen|notizen|zusammenfassung|lernset|skript|vorlesung|kapitel)$/i.test(
    value
  );
}

function buildTopicTitle(text: string, topics: string[]): string {
  const main = toTitleWord(topics[0] ?? "");
  const secondary = toTitleWord(topics[1] ?? "");
  const examContext = /(aufgabe|klausur|prüfung|exam|test)/i.test(text);

  if (!main) return "";
  if (examContext) {
    return secondary
      ? `Prüfungsvorbereitung: ${main} und ${secondary}`
      : `Prüfungsvorbereitung: ${main}`;
  }
  return secondary ? `Grundlagen zu ${main} und ${secondary}` : `Grundlagen zu ${main}`;
}

function detectTitle(text: string, filename: string, topics: string[]): string {
  const lines = getLines(text).slice(0, 80);
  const markdownTitle = lines.find((line) => /^#\s+.{3,120}$/.test(line));
  if (markdownTitle) {
    const candidate = normalizeTitleCandidate(markdownTitle);
    if (!isGenericTitle(candidate)) return candidate;
  }

  const structuredLine = lines.find(
    (line) =>
      line.length >= 8 &&
      line.length <= 90 &&
      !/[.:!?]$/.test(line) &&
      /[A-Za-zÄÖÜäöüß]/.test(line) &&
      /^[\dA-Za-zÄÖÜäöüß _\-()/]+$/.test(line)
  );

  if (structuredLine) {
    const candidate = normalizeTitleCandidate(structuredLine);
    if (!isGenericTitle(candidate)) return candidate;
  }

  const topicTitle = buildTopicTitle(text, topics);
  if (topicTitle) return topicTitle;

  return fallbackTitle(filename);
}

function computeStats(text: string) {
  const words = text.match(/[A-Za-zÄÖÜäöüß0-9]{2,}/g) ?? [];
  const lines = getLines(text);
  const headingLines = lines.filter(
    (line) =>
      /^#\s+/.test(line) ||
      /^[0-9]+(\.[0-9]+)*\s+[A-Za-zÄÖÜäöüß]/.test(line) ||
      (/^[A-ZÄÖÜ0-9 ]{8,}$/.test(line) && line.length < 100)
  );
  const sentences = text
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  const sentenceWordCounts = sentences.map(
    (sentence) => (sentence.match(/[A-Za-zÄÖÜäöüß0-9]{2,}/g) ?? []).length
  );
  const averageSentenceLength =
    sentenceWordCounts.length > 0
      ? sentenceWordCounts.reduce((sum, count) => sum + count, 0) / sentenceWordCounts.length
      : 0;
  const headingDensity = lines.length > 0 ? headingLines.length / lines.length : 0;
  return {
    wordCount: words.length,
    headingDensity,
    averageSentenceLength,
    words,
  };
}

function detectTopics(text: string): string[] {
  const words = (text.toLowerCase().match(/[a-zäöüß]{4,}/g) ?? []).filter(
    (word) => !STOP_WORDS.has(word)
  );
  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  const topics = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([topic]) => topic);

  return topics;
}

function deriveDifficulty(text: string): DifficultyOption {
  const words = text.match(/[A-Za-zÄÖÜäöüß]{2,}/g) ?? [];
  if (words.length < 120) return "mittel";

  const longWords = words.filter((word) => word.length >= 12).length;
  const sentenceList = text
    .split(/[.!?]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const sentenceWords = sentenceList.map(
    (sentence) => (sentence.match(/[A-Za-zÄÖÜäöüß]{2,}/g) ?? []).length
  );
  const avgSentenceLength =
    sentenceWords.length > 0
      ? sentenceWords.reduce((sum, value) => sum + value, 0) / sentenceWords.length
      : 0;
  const longWordRatio = longWords / Math.max(words.length, 1);
  const complexity = avgSentenceLength * 0.7 + longWordRatio * 100 * 0.3;

  if (complexity >= 20.5) return "anspruchsvoll";
  if (complexity <= 13) return "leicht";
  return "mittel";
}

function deriveQuestionCount(wordCount: number): number {
  if (wordCount < 700) return 5;
  if (wordCount < 2200) return 8;
  return 10;
}

function deriveStyle(text: string, headingDensity: number): StyleOption {
  const hasExamStructure = /(aufgabe|klausur|multiple choice|frage\s+\d+|übung|exercise)/i.test(
    text
  );
  const hasTheoryMarkers = /(definition|begriff|satz|lemma|theorem|erklärung|konzept)/i.test(text);
  if (hasExamStructure || headingDensity > 0.12) return "pruefungsnah";
  if (hasTheoryMarkers) return "erklärend";
  return "kompakt";
}

function clampQuestionCount(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 8;
  return Math.max(MIN_QUESTION_COUNT, Math.min(MAX_QUESTION_COUNT, Math.round(numeric)));
}

function normalizeDifficulty(value: unknown, fallback: DifficultyOption): DifficultyOption {
  if (value === "leicht" || value === "mittel" || value === "anspruchsvoll") return value;
  if (value === "schwer") return "anspruchsvoll";
  return fallback;
}

function normalizeStyle(value: unknown, fallback: StyleOption): StyleOption {
  if (value === "kompakt" || value === "pruefungsnah" || value === "erklärend") return value;
  if (value === "pruefung") return "pruefungsnah";
  return fallback;
}

export async function extractTextFromFile(
  file: File | null
): Promise<{ normalizedText: string; filename: string }> {
  if (!file) {
    throw new CreateDeckError({
      code: "INVALID_REQUEST",
      status: 400,
      retryable: false,
      message: "Es fehlt eine Datei. Bitte lade eine Datei hoch.",
    });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new CreateDeckError({
      code: "FILE_TOO_LARGE",
      status: 413,
      retryable: false,
      message: `Die Datei ist größer als ${MAX_UPLOAD_MB}MB. Komprimiere sie oder teile sie auf.`,
    });
  }

  const extension = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new CreateDeckError({
      code: "UNSUPPORTED_FILE_TYPE",
      status: 400,
      retryable: false,
      message: "Bitte lade eine PDF-, TXT- oder MD-Datei hoch.",
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let text = "";
  try {
    if (extension === ".pdf") {
      const parsed = await pdfParse(buffer);
      text = parsed.text ?? "";
    } else {
      text = buffer.toString("utf-8");
    }
  } catch {
    throw new CreateDeckError({
      code: "PARSING_ERROR",
      status: 422,
      retryable: true,
      message: "Das Dokument konnte nicht gelesen werden. Bitte als PDF/TXT exportieren.",
    });
  }

  const normalizedText = normalizeText(text);
  if (!normalizedText) {
    throw new CreateDeckError({
      code: "EMPTY_DOCUMENT",
      status: 422,
      retryable: false,
      message: "Das Dokument ist leer. Bitte lade eine Datei mit Inhalt hoch.",
    });
  }

  return { normalizedText, filename: file.name };
}

export function deriveGenerationParams(text: string, filename: string): DerivedGenerationParams {
  const stats = computeStats(text);
  const detectedTopics = detectTopics(text);
  return {
    suggestedTitle: detectTitle(text, filename, detectedTopics),
    suggestedDifficulty: deriveDifficulty(text),
    suggestedQuestionCount: deriveQuestionCount(stats.wordCount),
    suggestedStyle: deriveStyle(text, stats.headingDensity),
    detectedTopics,
    stats: {
      wordCount: stats.wordCount,
      headingDensity: stats.headingDensity,
      averageSentenceLength: stats.averageSentenceLength,
    },
  };
}

function compactText(input: string, maxLength: number): string {
  return input.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function buildTitleContext(text: string, topics: string[]) {
  const lines = getLines(text).slice(0, 120);
  const headings = lines
    .filter((line) => /^#\s+/.test(line) || /^[0-9]+(\.[0-9]+)*\s+[A-Za-zÄÖÜäöüß]/.test(line))
    .slice(0, 6)
    .map((line) => normalizeTitleCandidate(line));
  const excerptA = compactText(text.slice(0, 900), 340);
  const middleStart = Math.max(0, Math.floor(text.length * 0.45));
  const excerptB = compactText(text.slice(middleStart, middleStart + 900), 340);

  return {
    headings: headings.join(" | ") || "-",
    topics: topics.slice(0, 6).join(", ") || "-",
    excerptA: excerptA || "-",
    excerptB: excerptB || "-",
  };
}

function sanitizeAiTitle(input: string): string {
  const cleaned = normalizeTitleCandidate(String(input ?? ""));
  if (!cleaned) return "";
  return cleaned.slice(0, 45);
}

export async function deriveGenerationParamsWithAiTitle(input: {
  openai: OpenAI;
  text: string;
  filename: string;
}): Promise<DerivedGenerationParams> {
  const { openai, text, filename } = input;
  const derived = deriveGenerationParams(text, filename);
  const fallbackTitle = derived.suggestedTitle;
  const context = buildTitleContext(text, derived.detectedTopics);

  try {
    const systemPrompt = loadPrompt("ai-title-system");
    const userPrompt = loadRenderedPrompt("ai-title-user", {
      filename,
      topics: context.topics,
      headings: context.headings,
      excerpt_a: context.excerptA,
      excerpt_b: context.excerptB,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 60,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { title?: string };
    const candidate = sanitizeAiTitle(parsed.title ?? "");

    if (!candidate || isGenericTitle(candidate)) {
      return derived;
    }

    return {
      ...derived,
      suggestedTitle: candidate,
    };
  } catch {
    return {
      ...derived,
      suggestedTitle: fallbackTitle,
    };
  }
}

export function resolveGenerationParams(input: {
  derived: DerivedGenerationParams;
  title?: string | null;
  style?: string | null;
  difficulty?: string | null;
  count?: string | number | null;
  topicFocus?: string | null;
}): ResolvedGenerationParams {
  const { derived } = input;
  const title = String(input.title ?? "").trim() || derived.suggestedTitle || fallbackTitle("upload");
  const style = normalizeStyle(input.style, derived.suggestedStyle);
  const difficulty = normalizeDifficulty(input.difficulty, derived.suggestedDifficulty);
  const count = clampQuestionCount(input.count ?? derived.suggestedQuestionCount);
  const topicFocus = String(input.topicFocus ?? "").trim();
  return {
    title,
    style,
    difficulty,
    count,
    topicFocus,
  };
}

function qualityCheckCards(cards: CardPayload[], requestedCount: number): CardPayload[] {
  const dedupe = new Set<string>();
  const cleaned: CardPayload[] = [];

  for (const card of cards) {
    const question = String(card.question ?? "").trim();
    const answer = String(card.answer ?? "").trim();
    if (!question || !answer) continue;
    const key = question.toLowerCase();
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    cleaned.push({ question, answer });
    if (cleaned.length >= requestedCount) break;
  }

  return cleaned;
}

export async function generateCardsFromText(input: {
  openai: OpenAI;
  text: string;
  params: ResolvedGenerationParams;
  detectedTopics: string[];
  mode?: GenerationMode;
}): Promise<CardPayload[]> {
  const { openai, text, params, detectedTopics } = input;
  const mode = input.mode ?? "default";
  const promptStyle = params.style === "pruefungsnah" ? "anwenden" : "verstehen";

  const systemPrompt = loadPrompt("ai-generate");
  const modeHint = loadRenderedPrompt("ai-generate-mode", { mode }).trim();
  const userPrompt = loadRenderedPrompt("ai-generate-user", {
    title: params.title,
    style: promptStyle,
    difficulty: params.difficulty,
    count: params.count,
    detected_topics: detectedTopics.join(", ") || "keine",
    topic_focus: params.topicFocus || "keiner",
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
    temperature: mode === "alternate" ? 0.45 : 0.2,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: { cards?: CardPayload[] } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CreateDeckError({
      code: "AI_RESPONSE_INVALID",
      status: 502,
      retryable: true,
      message: "Die KI-Antwort war unvollständig. Bitte erneut versuchen.",
    });
  }

  return qualityCheckCards(parsed.cards ?? [], params.count);
}

export function mapCreateDeckError(error: unknown): CreateDeckError {
  if (error instanceof CreateDeckError) return error;

  const message = String((error as Error | undefined)?.message ?? "");
  if (/timeout/i.test(message)) {
    return new CreateDeckError({
      code: "AI_TIMEOUT",
      status: 504,
      retryable: true,
      message: "Die Generierung dauert ungewöhnlich lange. Wir versuchen es erneut…",
    });
  }

  return new CreateDeckError({
    code: "AI_GENERATION_FAILED",
    status: 500,
    retryable: true,
    message: "Die Generierung ist fehlgeschlagen. Bitte versuche es erneut.",
  });
}
