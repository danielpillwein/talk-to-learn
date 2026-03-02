"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { clearHeroUpload, loadHeroUpload } from "@/lib/hero-upload-store";

type CardDraft = {
  question: string;
  answer: string;
};

type SaveDraftPayload = {
  title: string;
  cards: CardDraft[];
};

type DifficultyOption = "leicht" | "mittel" | "anspruchsvoll";
type StyleOption = "kompakt" | "pruefungsnah" | "erklaerend";
type QuestionCount = number;
type RetryAction = "derive" | "generate" | "regenerate" | "save";
type RefineAction = "expandAnswer" | "condenseAnswer";
type StageKey = "analyze" | "topics" | "generate" | "quality";

type ApiErrorState = {
  code?: string;
  message: string;
  retryable: boolean;
  action?: RetryAction;
};

type WorkingDraftPayload = {
  title: string;
  cards: CardDraft[];
  style: StyleOption;
  difficulty: DifficultyOption;
  count: QuestionCount;
  topicFocus: string;
  detectedTopics: string[];
  fileName: string;
  analysisReady: boolean;
};

type DeriveResponse = {
  suggestedTitle: string;
  suggestedDifficulty: DifficultyOption;
  suggestedQuestionCount: QuestionCount;
  suggestedStyle: StyleOption;
  detectedTopics: string[];
  stats?: {
    wordCount?: number;
  };
};

type GenerateResponse = {
  cards?: CardDraft[];
  params?: {
    title?: string;
  };
};

const SAVE_DRAFT_KEY = "ttl:create-deck-draft";
const WORKING_DRAFT_KEY = "ttl:create-deck-working-draft";
const HERO_UPLOAD_SESSION_KEY = "ttl:hero-upload";
const MAX_UPLOAD_MB = 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const STAGE_DEFS: Array<{ key: StageKey; label: string }> = [
  { key: "analyze", label: "Dokument analysieren" },
  { key: "topics", label: "Themen erkennen" },
  { key: "generate", label: "Fragen generieren" },
  { key: "quality", label: "Qualität prüfen" },
];
const FLOW_STEPS = [
  { id: 1, title: "Datei hochladen" },
  { id: 2, title: "Parameter prüfen" },
  { id: 3, title: "Vorschau bearbeiten" },
] as const;
type FlowStepId = (typeof FLOW_STEPS)[number]["id"];

const STYLE_LABELS: Record<StyleOption, string> = {
  kompakt: "Kompakt",
  pruefungsnah: "Prüfungsnah",
  erklaerend: "Erklärend",
};

const DIFFICULTY_LABELS: Record<DifficultyOption, string> = {
  leicht: "Einfach",
  mittel: "Mittel",
  anspruchsvoll: "Anspruchsvoll",
};

function isDifficulty(value: unknown): value is DifficultyOption {
  return value === "leicht" || value === "mittel" || value === "anspruchsvoll";
}

function isStyle(value: unknown): value is StyleOption {
  return value === "kompakt" || value === "pruefungsnah" || value === "erklaerend";
}

function normalizeCount(value: unknown): QuestionCount {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 8;
  return Math.max(2, Math.min(10, Math.round(numeric)));
}

function isAllowedFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return lower.endsWith(".pdf") || lower.endsWith(".txt") || lower.endsWith(".md");
}

function decodeHeroUploadFromSession(): File | null {
  try {
    const raw = window.sessionStorage.getItem(HERO_UPLOAD_SESSION_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(HERO_UPLOAD_SESSION_KEY);

    const parsed = JSON.parse(raw) as {
      name?: string;
      type?: string;
      dataBase64?: string;
    };

    if (!parsed?.name || !parsed?.dataBase64) return null;

    const binary = atob(parsed.dataBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new File([bytes], parsed.name, {
      type: parsed.type || "application/octet-stream",
    });
  } catch {
    return null;
  }
}

function saveLoginDraft(payload: SaveDraftPayload) {
  try {
    window.localStorage.setItem(SAVE_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage issues.
  }
}

function loadLoginDraft(): SaveDraftPayload | null {
  try {
    const raw = window.localStorage.getItem(SAVE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveDraftPayload;
    if (!parsed?.title || !Array.isArray(parsed.cards)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearLoginDraft() {
  try {
    window.localStorage.removeItem(SAVE_DRAFT_KEY);
  } catch {
    // Ignore storage issues.
  }
}

function saveWorkingDraft(payload: WorkingDraftPayload) {
  try {
    window.localStorage.setItem(WORKING_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage issues.
  }
}

function loadWorkingDraft(): WorkingDraftPayload | null {
  try {
    const raw = window.localStorage.getItem(WORKING_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkingDraftPayload;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.cards)) return null;

    return {
      title: String(parsed.title ?? ""),
      cards: parsed.cards
        .map((card) => ({
          question: String(card.question ?? ""),
          answer: String(card.answer ?? ""),
        }))
        .filter((card) => card.question || card.answer),
      style: isStyle(parsed.style) ? parsed.style : "kompakt",
      difficulty: isDifficulty(parsed.difficulty) ? parsed.difficulty : "mittel",
      count: normalizeCount(parsed.count),
      topicFocus: String(parsed.topicFocus ?? ""),
      detectedTopics: Array.isArray(parsed.detectedTopics)
        ? parsed.detectedTopics.map((topic) => String(topic))
        : [],
      fileName: String(parsed.fileName ?? ""),
      analysisReady: Boolean(parsed.analysisReady),
    };
  } catch {
    return null;
  }
}

function clearWorkingDraft() {
  try {
    window.localStorage.removeItem(WORKING_DRAFT_KEY);
  } catch {
    // Ignore storage issues.
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function FlowStepper(props: {
  activeStep: FlowStepId;
  canOpenStep2: boolean;
  canOpenStep3: boolean;
  isStep1Complete: boolean;
  isStep2Complete: boolean;
  isStep3Complete: boolean;
  onStepClick: (step: FlowStepId) => void;
}): JSX.Element {
  const { activeStep, canOpenStep2, canOpenStep3, isStep1Complete, isStep2Complete, isStep3Complete, onStepClick } = props;

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardContent className="p-4 md:p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          {FLOW_STEPS.map((entry, index) => {
            const stepId = entry.id;
            const active = activeStep === stepId;
            const complete =
              stepId === 1
                ? isStep1Complete
                : stepId === 2
                  ? isStep2Complete
                  : isStep3Complete;
            const clickable =
              stepId === 1 ||
              (stepId === 2 && canOpenStep2) ||
              (stepId === 3 && canOpenStep3);

            return (
              <div key={entry.id} className="flex items-center gap-2 md:flex-1">
                <button
                  type="button"
                  onClick={() => clickable && onStepClick(stepId)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                    active
                      ? "border-primary/60 bg-primary/10"
                      : complete
                        ? "border-success/50 bg-success/10"
                        : "border-border bg-background"
                  } ${clickable ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                  disabled={!clickable}
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs font-semibold text-foreground">
                    {complete ? "✓" : stepId}
                  </span>
                  <span className="text-sm font-medium text-foreground">{entry.title}</span>
                </button>
                {index < FLOW_STEPS.length - 1 && (
                  <span className="hidden md:inline-block text-muted-foreground">→</span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function StepSection(props: {
  id: FlowStepId;
  title: string;
  active: boolean;
  complete: boolean;
  disabled?: boolean;
  onOpen: () => void;
  children: ReactNode;
}): JSX.Element {
  const { id, title, active, complete, disabled, onOpen, children } = props;
  return (
    <Card className={`border-border bg-card shadow-sm ${active ? "" : "opacity-95"}`}>
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-xs font-semibold text-foreground">
            {complete ? "✓" : id}
          </span>
          <p className="text-sm font-semibold text-foreground">{title}</p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {active ? "Aktiv" : "Öffnen"}
        </span>
      </button>
      {active && <CardContent className="space-y-4 pt-0">{children}</CardContent>}
    </Card>
  );
}

async function parseApiError(response: Response, fallbackMessage: string): Promise<ApiErrorState> {
  const fallback: ApiErrorState = {
    message: fallbackMessage,
    retryable: response.status >= 500,
  };

  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string") {
      return {
        code: undefined,
        message: payload.error,
        retryable: fallback.retryable,
      };
    }

    if (payload.error && typeof payload.error === "object") {
      const structured = payload.error as {
        code?: unknown;
        message?: unknown;
        retryable?: unknown;
      };
      return {
        code: typeof structured.code === "string" ? structured.code : undefined,
        message:
          typeof structured.message === "string" && structured.message
            ? structured.message
            : fallbackMessage,
        retryable:
          typeof structured.retryable === "boolean" ? structured.retryable : fallback.retryable,
      };
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export default function CreateDeckPage(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const user = session?.user;
  const forceNewFlow = searchParams.get("new") === "1";

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const step1Ref = useRef<HTMLDivElement | null>(null);
  const step2Ref = useRef<HTMLDivElement | null>(null);
  const step3Ref = useRef<HTMLDivElement | null>(null);
  const dragCounter = useRef(0);
  const autoSaveTriggered = useRef(false);
  const hasTrackedCardEdit = useRef(false);
  const generateStartedAt = useRef<number | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");

  const [title, setTitle] = useState("");
  const [style, setStyle] = useState<StyleOption>("kompakt");
  const [difficulty, setDifficulty] = useState<DifficultyOption>("mittel");
  const [count, setCount] = useState<QuestionCount>(8);
  const [topicFocus, setTopicFocus] = useState("");
  const [detectedTopics, setDetectedTopics] = useState<string[]>([]);

  const [cards, setCards] = useState<CardDraft[]>([]);
  const [editingField, setEditingField] = useState<{ index: number; key: keyof CardDraft } | null>(
    null
  );

  const [analysisReady, setAnalysisReady] = useState(false);

  const [isDeriving, setIsDeriving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [refineLoading, setRefineLoading] = useState<{ index: number; action: RefineAction } | null>(
    null
  );

  const [loaderOpen, setLoaderOpen] = useState(false);
  const [activeStage, setActiveStage] = useState<StageKey | null>(null);

  const [error, setError] = useState<ApiErrorState | null>(null);
  const [activeStep, setActiveStep] = useState<FlowStepId>(1);

  const canGenerate = analysisReady && !!file && !isGenerating;
  const canOpenStep2 = analysisReady;
  const canOpenStep3 = cards.length > 0;
  const isStep1Complete = Boolean(file);
  const isStep2Complete = analysisReady;
  const isStep3Complete = cards.length > 0;

  const goToStep = (nextStep: FlowStepId) => {
    setActiveStep(nextStep);
    window.setTimeout(() => {
      const map: Record<FlowStepId, HTMLDivElement | null> = {
        1: step1Ref.current,
        2: step2Ref.current,
        3: step3Ref.current,
      };
      map[nextStep]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };
  const activeProcessingLabel = useMemo(() => {
    if (activeStage) {
      const stage = STAGE_DEFS.find((entry) => entry.key === activeStage);
      if (stage) return stage.label;
    }
    if (isDeriving) return "Dokument analysieren";
    if (isGenerating) return "Fragen generieren";
    return "Verarbeite Anfrage";
  }, [activeStage, isDeriving, isGenerating]);

  const trackEvent = (event: string, payload: Record<string, unknown>) => {
    void fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, payload }),
      keepalive: true,
    }).catch(() => {
      // Analytics should never block UX.
    });
  };

  const setActionError = (nextError: ApiErrorState | null, action?: RetryAction) => {
    if (!nextError) {
      setError(null);
      return;
    }

    setError({ ...nextError, action });
  };

  const resetFlowForNewFile = (selectedFile: File | null) => {
    setFile(selectedFile);
    setFileName(selectedFile?.name ?? "");
    setAnalysisReady(false);
    setCards([]);
    setDetectedTopics([]);
    setTopicFocus("");
    setEditingField(null);
    setError(null);
    setActiveStep(1);
  };

  const consumeFile = (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (!isAllowedFile(selectedFile)) {
      setActionError(
        {
          message: "Bitte lade eine PDF-, TXT- oder MD-Datei hoch.",
          retryable: false,
        },
        undefined
      );
      return;
    }
    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      setActionError(
        {
          message: `Die Datei ist größer als ${MAX_UPLOAD_MB}MB. Komprimiere sie oder teile sie auf.`,
          retryable: false,
        },
        undefined
      );
      return;
    }

    resetFlowForNewFile(selectedFile);
  };

  const hydrateFromDerive = (payload: DeriveResponse) => {
    const nextTitle = String(payload.suggestedTitle ?? "").trim();
    const nextDifficulty = isDifficulty(payload.suggestedDifficulty)
      ? payload.suggestedDifficulty
      : "mittel";
    const nextCount = normalizeCount(payload.suggestedQuestionCount);
    const nextStyle = isStyle(payload.suggestedStyle) ? payload.suggestedStyle : "kompakt";
    const nextTopics = Array.isArray(payload.detectedTopics)
      ? payload.detectedTopics.slice(0, 6).map((topic) => String(topic))
      : [];

    setTitle(nextTitle);
    setDifficulty(nextDifficulty);
    setCount(nextCount);
    setStyle(nextStyle);
    setDetectedTopics(nextTopics);
  };

  const handlePrepare = async () => {
    if (!file) {
      setActionError(
        {
          message: "Bitte wähle zuerst eine Datei aus.",
          retryable: false,
        },
        undefined
      );
      return;
    }

    setActionError(null);
    setIsDeriving(true);
    setLoaderOpen(true);
    setActiveStage("analyze");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/ai/derive-file", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const parsed = await parseApiError(response, "Die Dokumentanalyse ist fehlgeschlagen.");
        setActionError(parsed, "derive");
        return;
      }

      setActiveStage("topics");

      const payload = (await response.json()) as DeriveResponse;
      hydrateFromDerive(payload);
      await delay(220);

      setAnalysisReady(true);
      goToStep(2);
      trackEvent("derive_completed", {
        detected_topics_count: payload.detectedTopics?.length ?? 0,
      });
    } finally {
      setIsDeriving(false);
      setActiveStage(null);
      setLoaderOpen(false);
    }
  };

  const runGeneration = async (action: "generate" | "regenerate") => {
    if (!file) {
      setActionError(
        {
          message:
            "Die Originaldatei ist nicht mehr verfügbar. Lade sie kurz neu hoch, um wieder zu generieren.",
          retryable: false,
        },
        undefined
      );
      return;
    }

    setActionError(null);
    setIsGenerating(true);
    setLoaderOpen(true);
    setActiveStage("generate");
    generateStartedAt.current = performance.now();

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim());
      formData.append("style", style);
      formData.append("difficulty", difficulty);
      formData.append("count", String(count));
      formData.append("topicFocus", topicFocus.trim());

      const endpoint = action === "generate" ? "/api/ai/generate-file" : "/api/ai/regenerate";
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const parsed = await parseApiError(response, "Die Generierung ist fehlgeschlagen.");
        setActionError(parsed, action === "generate" ? "generate" : "regenerate");
        return;
      }

      const payload = (await response.json()) as GenerateResponse;
      setActiveStage("quality");

      const nextCards = Array.isArray(payload.cards)
        ? payload.cards
            .map((card) => ({
              question: String(card.question ?? "").trim(),
              answer: String(card.answer ?? "").trim(),
            }))
            .filter((card) => card.question && card.answer)
        : [];

      if (nextCards.length === 0) {
        setActionError(
          {
            message: "Es konnten keine brauchbaren Fragen erzeugt werden. Bitte erneut versuchen.",
            retryable: true,
          },
          action === "generate" ? "generate" : "regenerate"
        );
        return;
      }

      if (!title.trim() && payload.params?.title) {
        setTitle(String(payload.params.title));
      }

      await delay(140);
      setCards(nextCards);
      setAnalysisReady(true);
      goToStep(3);

      const elapsedMs =
        generateStartedAt.current === null
          ? null
          : Math.max(0, Math.round(performance.now() - generateStartedAt.current));

      if (action === "generate") {
        trackEvent("time_to_generate", {
          ms: elapsedMs,
          card_count: nextCards.length,
          style,
          difficulty,
          count,
        });
      } else {
        trackEvent("regeneration_rate", {
          style,
          difficulty,
          count,
          card_count: nextCards.length,
        });
      }
    } finally {
      setIsGenerating(false);
      setActiveStage(null);
      setLoaderOpen(false);
    }
  };

  const handleGenerate = async () => {
    await runGeneration("generate");
  };

  const handleRegenerate = async () => {
    await runGeneration("regenerate");
  };

  const handleUpdateCard = (index: number, key: keyof CardDraft, value: string) => {
    setCards((prev) =>
      prev.map((card, idx) => (idx === index ? { ...card, [key]: value } : card))
    );

    if (!hasTrackedCardEdit.current) {
      hasTrackedCardEdit.current = true;
      trackEvent("review_cards_edited", { first_edit: true });
    }
  };

  const handleAddCard = () => {
    setCards((prev) => [...prev, { question: "", answer: "" }]);
  };

  const handleRemoveCard = (index: number) => {
    setCards((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleRefineCard = async (index: number, action: RefineAction) => {
    const card = cards[index];
    if (!card) return;
    const question = card.question.trim();
    const answer = card.answer.trim();
    if (!question || !answer) {
      setActionError(
        {
          message: "Bitte zuerst Frage und Antwort ausfüllen, dann kann die Antwort verfeinert werden.",
          retryable: false,
        },
        undefined
      );
      return;
    }

    setRefineLoading({ index, action });
    setActionError(null);

    try {
      const response = await fetch("/api/ai/refine-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          answer,
          action,
          title,
          style,
          difficulty,
          topicFocus,
        }),
      });

      if (!response.ok) {
        const parsed = await parseApiError(response, "Die Verfeinerung ist fehlgeschlagen.");
        setActionError(parsed, undefined);
        return;
      }

      const payload = (await response.json()) as { card?: CardDraft };
      if (!payload.card) {
        setActionError(
          {
            message: "Die Verfeinerung hat kein gültiges Ergebnis geliefert.",
            retryable: true,
          },
          undefined
        );
        return;
      }

      setCards((prev) =>
        prev.map((entry, idx) =>
          idx === index
            ? {
                question: String(payload.card?.question ?? "").trim(),
                answer: String(payload.card?.answer ?? "").trim(),
              }
            : entry
        )
      );

      trackEvent("card_refined", { action });
    } finally {
      setRefineLoading(null);
    }
  };

  const handleSave = async () => {
    setActionError(null);
    setIsSaving(true);

    try {
      const cleaned = cards
        .map((card) => ({
          question: card.question.trim(),
          answer: card.answer.trim(),
        }))
        .filter((card) => card.question && card.answer);

      if (cleaned.length === 0) {
        setActionError(
          {
            message: "Bitte mindestens eine Frage mit Antwort anlegen.",
            retryable: false,
          },
          undefined
        );
        return;
      }

      const finalTitle = title.trim() || fileName.replace(/\.[^.]+$/, "") || "Lernset";

      if (!user) {
        saveLoginDraft({ title: finalTitle, cards: cleaned });
        router.push("/auth/sign-in?callbackUrl=/app/create");
        return;
      }

      const response = await fetch("/api/ai/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: finalTitle,
          cards: cleaned,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          saveLoginDraft({ title: finalTitle, cards: cleaned });
          router.push("/auth/sign-in?callbackUrl=/app/create");
          return;
        }

        const parsed = await parseApiError(response, "Speichern fehlgeschlagen.");
        setActionError(parsed, "save");
        return;
      }

      clearLoginDraft();
      clearWorkingDraft();

      trackEvent("save_conversion_rate", {
        cards: cleaned.length,
        source: "create",
      });

      router.push("/app/learn");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetry = async () => {
    if (!error?.action) return;
    if (error.action === "derive") {
      await handlePrepare();
      return;
    }
    if (error.action === "generate") {
      await handleGenerate();
      return;
    }
    if (error.action === "regenerate") {
      await handleRegenerate();
      return;
    }
    if (error.action === "save") {
      await handleSave();
    }
  };

  useEffect(() => {
    if (forceNewFlow) return;

    const cached = loadWorkingDraft();
    if (!cached) return;

    if (cached.title) setTitle(cached.title);
    if (cached.cards.length > 0) setCards(cached.cards);
    if (cached.fileName) setFileName(cached.fileName);
    setStyle(cached.style);
    setDifficulty(cached.difficulty);
    setCount(cached.count);
    setTopicFocus(cached.topicFocus);
    setDetectedTopics(cached.detectedTopics);
    setAnalysisReady(cached.analysisReady || cached.cards.length > 0);
    if (cached.cards.length > 0) {
      setActiveStep(3);
    } else if (cached.analysisReady) {
      setActiveStep(2);
    } else if (cached.fileName) {
      setActiveStep(1);
    }
  }, [forceNewFlow]);

  useEffect(() => {
    if (!forceNewFlow) return;

    clearWorkingDraft();
    clearLoginDraft();
    autoSaveTriggered.current = false;

    setFile(null);
    setFileName("");
    setCards([]);
    setEditingField(null);
    setAnalysisReady(false);
    setDetectedTopics([]);
    setTopicFocus("");
    setError(null);
    setActiveStep(1);
    setTitle("");
    setStyle("kompakt");
    setDifficulty("mittel");
    setCount(8);
    setRefineLoading(null);
    setIsDeriving(false);
    setIsGenerating(false);
    setIsSaving(false);
    setLoaderOpen(false);
    setActiveStage(null);
    setIsDragging(false);
    dragCounter.current = 0;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    router.replace("/app/create", { scroll: false });
  }, [forceNewFlow, router]);

  useEffect(() => {
    if (forceNewFlow) {
      clearWorkingDraft();
      return;
    }

    const hasContent =
      title.trim() ||
      fileName ||
      cards.length > 0 ||
      analysisReady ||
      topicFocus.trim() ||
      detectedTopics.length > 0;

    if (!hasContent) {
      clearWorkingDraft();
      return;
    }

    const timeout = window.setTimeout(() => {
      saveWorkingDraft({
        title,
        cards,
        style,
        difficulty,
        count,
        topicFocus,
        detectedTopics,
        fileName,
        analysisReady,
      });
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    title,
    cards,
    style,
    difficulty,
    count,
    topicFocus,
    detectedTopics,
    fileName,
    analysisReady,
    forceNewFlow,
  ]);

  useEffect(() => {
    if (file) return;

    let active = true;
    const fetchUpload = async () => {
      const fromSession = decodeHeroUploadFromSession();
      if (fromSession && active) {
        consumeFile(fromSession);
        return;
      }

      const uploaded = await loadHeroUpload();
      if (!active || !uploaded) return;
      consumeFile(uploaded);
      await clearHeroUpload();
    };

    void fetchUpload();
    return () => {
      active = false;
    };
  }, [file]);

  useEffect(() => {
    if (!user || autoSaveTriggered.current) return;

    const draft = loadLoginDraft();
    if (!draft) return;

    autoSaveTriggered.current = true;

    if (!title.trim()) {
      setTitle(draft.title);
    }
    if (cards.length === 0) {
      setCards(draft.cards);
      setAnalysisReady(true);
    }

    const autoSave = async () => {
      setIsSaving(true);
      setActionError(null);

      try {
        const response = await fetch("/api/ai/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draft.title,
            cards: draft.cards,
          }),
        });

        if (!response.ok) {
          const parsed = await parseApiError(response, "Speichern fehlgeschlagen.");
          setActionError(parsed, "save");
          return;
        }

        clearLoginDraft();
        clearWorkingDraft();
        router.replace("/app/learn");
      } finally {
        setIsSaving(false);
      }
    };

    void autoSave();
  }, [user, router, cards.length, title]);

  return (
    <main className="relative py-8">
      {loaderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card px-6 py-6 text-center shadow-sm">
            <p className="text-base font-semibold text-foreground">{activeProcessingLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">Bitte kurz warten…</p>
            <div className="mt-4 flex justify-center">
              <span className="h-5 w-5 rounded-full border-2 border-border border-t-foreground animate-spin" />
            </div>
          </div>
        </div>
      )}

      <div className="relative flex flex-col gap-6">
        <FlowStepper
          activeStep={activeStep}
          canOpenStep2={canOpenStep2}
          canOpenStep3={canOpenStep3}
          isStep1Complete={isStep1Complete}
          isStep2Complete={isStep2Complete}
          isStep3Complete={isStep3Complete}
          onStepClick={goToStep}
        />

        <div ref={step1Ref}>
          <StepSection
            id={1}
            title="Datei hochladen"
            active={activeStep === 1}
            complete={isStep1Complete}
            onOpen={() => goToStep(1)}
          >
            {!fileName ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  fileInputRef.current?.click();
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (!event.dataTransfer.types.includes("Files")) return;
                  dragCounter.current += 1;
                  setIsDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!event.dataTransfer.types.includes("Files")) return;
                  event.dataTransfer.dropEffect = "copy";
                  setIsDragging(true);
                }}
                onDragLeave={() => {
                  dragCounter.current = Math.max(0, dragCounter.current - 1);
                  if (dragCounter.current === 0) setIsDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  dragCounter.current = 0;
                  setIsDragging(false);
                  consumeFile(event.dataTransfer.files?.[0] ?? null);
                }}
                className={`group relative flex w-full min-h-[172px] cursor-pointer flex-col items-center justify-center gap-1 rounded-3xl border border-dashed bg-muted px-8 py-6 text-center transition ${
                  isDragging
                    ? "border-success/60 border-solid shadow-[inset_0_0_8px_5px_color-mix(in_srgb,var(--border)_30%,transparent)]"
                    : "border-success/50"
                }`}
                style={{ borderStyle: isDragging ? "solid" : undefined }}
              >
                <div className="absolute right-3 top-3 z-10">
                  <InfoTooltip title="Nur eine Datei (*.pdf, *.txt, *.md)">
                    <svg
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      className="h-5 w-5 fill-none text-border"
                    >
                      <path
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </svg>
                  </InfoTooltip>
                </div>
                <span className="text-lg font-semibold text-border">Datei hier ablegen, um direkt zu starten</span>
                <span className="text-sm font-medium text-border">oder klicken, um deine Unterlagen auszuwählen</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Datei</p>
                  <p className="text-sm font-semibold text-foreground">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    Größe: {file ? formatFileSize(file.size) : "nicht verfügbar"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    Datei wechseln
                  </Button>
                  <Button variant="outline" onClick={() => resetFlowForNewFile(null)}>
                    Entfernen
                  </Button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={(event) => consumeFile(event.target.files?.[0] ?? null)}
            />

            {activeStep === 1 && (
              <LoadingButton
                className="w-full md:w-auto"
                onClick={handlePrepare}
                disabled={!file || isDeriving}
                isLoading={isDeriving}
                loadingText="Analysiere"
                text="Unterlagen analysieren"
              />
            )}
          </StepSection>
        </div>

        <div ref={step2Ref}>
          <StepSection
            id={2}
            title="Parameter prüfen"
            active={activeStep === 2}
            complete={isStep2Complete}
            disabled={!canOpenStep2}
            onOpen={() => canOpenStep2 && goToStep(2)}
          >
            <p className="text-xs text-muted-foreground">Prüfe die Vorschläge und passe sie vor der Generierung an.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground">Titel</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm shadow-sm focus:border-foreground/20 focus:outline-none"
                  placeholder="Lernset-Titel"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground">Fokus (optional)</label>
                <p className="text-xs text-muted-foreground">
                  Ein Fokus lenkt die Fragen auf einen bestimmten Themenausschnitt.
                </p>
                <input
                  value={topicFocus}
                  onChange={(event) => setTopicFocus(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm shadow-sm focus:border-foreground/20 focus:outline-none"
                  placeholder="z. B. Prüfungsfragen, Kernkonzepte"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-muted-foreground">Stil</label>
              <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-1">
                {Object.entries(STYLE_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      style === value
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent"
                    }`}
                    onClick={() => setStyle(value as StyleOption)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-muted-foreground">Niveau</label>
              <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-1">
                {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      difficulty === value
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent"
                    }`}
                    onClick={() => setDifficulty(value as DifficultyOption)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-muted-foreground">Fragenanzahl</label>
              <div className="rounded-xl border border-border bg-background px-3 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">2</span>
                  <span className="font-semibold text-foreground">{count} Fragen</span>
                  <span className="text-muted-foreground">10</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={10}
                  step={1}
                  value={count}
                  onChange={(event) => setCount(normalizeCount(event.target.value))}
                  className="mt-2 w-full accent-primary"
                />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2">
                <span className="text-xs text-muted-foreground">Mehr als 10 Fragen</span>
                <Button type="button" variant="outline" size="sm" disabled>
                  Premium
                </Button>
              </div>
            </div>

            {detectedTopics.length > 0 && (
              <div className="space-y-2 rounded-xl border border-border bg-background px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Erkannte Themen
                </p>
                <div className="flex flex-wrap gap-2">
                  {detectedTopics.slice(0, 6).map((topic) => (
                    <span
                      key={topic}
                      className="inline-flex items-center rounded-lg border border-border px-2 py-1 text-xs text-foreground"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {activeStep === 2 && (
              <LoadingButton
                className="w-full md:w-auto"
                onClick={handleGenerate}
                disabled={!canGenerate}
                isLoading={isGenerating}
                loadingText="Generiere"
                text="Fragen generieren"
              />
            )}
          </StepSection>
        </div>

        <div ref={step3Ref}>
          <StepSection
            id={3}
            title="Vorschau bearbeiten"
            active={activeStep === 3}
            complete={isStep3Complete}
            disabled={!canOpenStep3}
            onOpen={() => canOpenStep3 && goToStep(3)}
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">{cards.length} Karten</p>
              <LoadingButton
                variant="outline"
                onClick={handleRegenerate}
                disabled={!file || isGenerating}
                isLoading={isGenerating}
                loadingText="Regeneriere"
                text="Neu generieren"
              />
            </div>

            {cards.map((card, index) => {
              const questionEditing =
                editingField?.index === index && editingField?.key === "question";
              const answerEditing = editingField?.index === index && editingField?.key === "answer";
              const isRefining = refineLoading?.index === index;

              return (
                <div key={index} className="space-y-3 rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Karte {index + 1}</p>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <LoadingButton
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefineCard(index, "expandAnswer")}
                        disabled={isRefining || !card.question.trim() || !card.answer.trim()}
                        isLoading={Boolean(isRefining && refineLoading?.action === "expandAnswer")}
                        loadingText="Verfeinere"
                        text="Antwort ausführlicher"
                      />
                      <LoadingButton
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefineCard(index, "condenseAnswer")}
                        disabled={isRefining || !card.question.trim() || !card.answer.trim()}
                        isLoading={Boolean(isRefining && refineLoading?.action === "condenseAnswer")}
                        loadingText="Verfeinere"
                        text="Antwort prägnanter"
                      />
                      <Button variant="outline" size="sm" onClick={() => handleRemoveCard(index)}>
                        Entfernen
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Frage
                    </label>
                    {questionEditing ? (
                      <Textarea
                        autoFocus
                        rows={3}
                        value={card.question}
                        onChange={(event) => handleUpdateCard(index, "question", event.target.value)}
                        onBlur={() => setEditingField(null)}
                        className="resize-none"
                      />
                    ) : (
                      <button
                        type="button"
                        className="w-full rounded-xl border border-border px-3 py-2 text-left text-sm text-foreground transition hover:border-foreground/30"
                        onClick={() => setEditingField({ index, key: "question" })}
                      >
                        {card.question || "Frage hinzufügen"}
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Antwort
                    </label>
                    {answerEditing ? (
                      <Textarea
                        autoFocus
                        rows={3}
                        value={card.answer}
                        onChange={(event) => handleUpdateCard(index, "answer", event.target.value)}
                        onBlur={() => setEditingField(null)}
                        className="resize-none"
                      />
                    ) : (
                      <button
                        type="button"
                        className="w-full rounded-xl border border-border px-3 py-2 text-left text-sm text-foreground transition hover:border-foreground/30"
                        onClick={() => setEditingField({ index, key: "answer" })}
                      >
                        {card.answer || "Antwort hinzufügen"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex flex-col gap-2 md:flex-row">
              <Button variant="outline" onClick={handleAddCard}>
                Karte hinzufügen
              </Button>
              <LoadingButton
                onClick={handleSave}
                disabled={isSaving}
                isLoading={isSaving}
                loadingText="Speichere"
                text="Lernset speichern"
              />
            </div>
            {!user && (
              <p className="text-sm text-muted-foreground">
                Zum Speichern wird ein kostenloser Account benötigt.
              </p>
            )}
          </StepSection>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <span>{error.message}</span>
                {error.retryable && error.action && (
                  <Button variant="outline" size="sm" onClick={handleRetry}>
                    Erneut versuchen
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </main>
  );
}
