"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowUpTrayIcon,
  ArrowsRightLeftIcon,
  ChevronDownIcon,
  SparklesIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
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
type LearningGoalOption = "verstehen" | "anwenden";
type ApiStyleOption = "kompakt" | "pruefungsnah" | "erklaerend";
type QuestionCount = number;
type RetryAction = "derive" | "generate" | "regenerate" | "save";
type RefineAction =
  | "expandAnswer"
  | "condenseAnswer"
  | "increaseDifficulty"
  | "simplifyAnswer"
  | "examOriented";
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
  learningGoal: LearningGoalOption;
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
  suggestedQuestionCount: number;
  suggestedStyle: ApiStyleOption;
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
  { key: "analyze", label: "Unterlagen verwenden" },
  { key: "topics", label: "Themen erkennen" },
  { key: "generate", label: "Fragen generieren" },
  { key: "quality", label: "Qualität prüfen" },
];
const FLOW_STEPS = [
  { id: 1, title: "Datei auswählen" },
  { id: 2, title: "Wie möchtest du lernen?" },
  { id: 3, title: "Lernset finalisieren" },
] as const;
type FlowStepId = (typeof FLOW_STEPS)[number]["id"];

const LEARNING_GOAL_LABELS: Record<LearningGoalOption, string> = {
  verstehen: "Verstehen",
  anwenden: "Anwenden",
};
const LEARNING_GOAL_HINTS: Record<LearningGoalOption, string> = {
  verstehen: "Mehr Verständnisfragen zu Begriffen, Zusammenhängen und dem Warum.",
  anwenden: "Mehr anwendungsnahe Fragen zu Situationen, Entscheidungen und Vorgehen.",
};

const DIFFICULTY_LABELS: Record<DifficultyOption, string> = {
  leicht: "Einfach",
  mittel: "Mittel",
  anspruchsvoll: "Anspruchsvoll",
};
const DIFFICULTY_HINTS: Record<DifficultyOption, string> = {
  leicht: "Leichter Einstieg mit klarer Sprache und direkteren Fragen.",
  mittel: "Ausgewogenes Niveau mit solider Tiefe und etwas Transfer.",
  anspruchsvoll: "Höhere Denktiefe mit komplexeren Fragen und präziserer Formulierung.",
};
const MIN_QUESTION_COUNT = 2;
const FREE_PLAN_QUESTION_LIMIT = 10;
const MAX_QUESTION_COUNT = 25;
const PREMIUM_BOUNDARY_VALUE = FREE_PLAN_QUESTION_LIMIT + 0.5;
const CARD_REFINE_OPTIONS: Array<{ action: RefineAction; label: string }> = [
  { action: "expandAnswer", label: "Ausführlicher" },
  { action: "condenseAnswer", label: "Prägnanter" },
  { action: "increaseDifficulty", label: "Schwieriger" },
  { action: "simplifyAnswer", label: "Vereinfachen" },
];

function isDifficulty(value: unknown): value is DifficultyOption {
  return value === "leicht" || value === "mittel" || value === "anspruchsvoll";
}

function isStyle(value: unknown): value is ApiStyleOption {
  return value === "kompakt" || value === "pruefungsnah" || value === "erklaerend";
}

function learningGoalFromStyle(value: unknown): LearningGoalOption {
  if (value === "pruefungsnah") return "anwenden";
  return "verstehen";
}

function styleFromLearningGoal(goal: LearningGoalOption): ApiStyleOption {
  return goal === "anwenden" ? "pruefungsnah" : "erklaerend";
}

function normalizeCount(value: unknown): QuestionCount {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 10;
  const rounded = Math.round(numeric);
  if (rounded < MIN_QUESTION_COUNT) return MIN_QUESTION_COUNT;
  if (rounded > MAX_QUESTION_COUNT) return MAX_QUESTION_COUNT;
  return rounded;
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
    const parsed = JSON.parse(raw) as WorkingDraftPayload & { style?: ApiStyleOption };
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
      learningGoal:
        parsed.learningGoal === "verstehen" || parsed.learningGoal === "anwenden"
          ? parsed.learningGoal
          : learningGoalFromStyle(parsed.style),
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
  subtitle?: string;
  active: boolean;
  complete: boolean;
  disabled?: boolean;
  onOpen: () => void;
  children: ReactNode;
}): JSX.Element {
  const { id, title, subtitle, active, complete, disabled, onOpen, children } = props;
  return (
    <Card className={`border-border bg-card shadow-sm ${active ? "" : "opacity-95"}`}>
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        className="flex w-full items-center gap-3 px-5 py-4 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-xs font-semibold text-foreground">
            {complete ? "✓" : id}
          </span>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
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
  const redirectFallbackTimer = useRef<number | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");

  const [title, setTitle] = useState("");
  const [learningGoal, setLearningGoal] = useState<LearningGoalOption>("verstehen");
  const [difficulty, setDifficulty] = useState<DifficultyOption>("mittel");
  const [questionCount, setQuestionCount] = useState<QuestionCount>(10);
  const [questionCountInput, setQuestionCountInput] = useState("10");
  const [topicFocus, setTopicFocus] = useState("");
  const [detectedTopics, setDetectedTopics] = useState<string[]>([]);
  const [focusOpen, setFocusOpen] = useState(false);

  const [cards, setCards] = useState<CardDraft[]>([]);

  const [analysisReady, setAnalysisReady] = useState(false);

  const [isDeriving, setIsDeriving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [openRefineMenuIndex, setOpenRefineMenuIndex] = useState<number | null>(null);
  const [refineLoading, setRefineLoading] = useState<{ index: number; action: RefineAction } | null>(
    null
  );

  const [loaderOpen, setLoaderOpen] = useState(false);
  const [activeStage, setActiveStage] = useState<StageKey | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const [error, setError] = useState<ApiErrorState | null>(null);
  const [activeStep, setActiveStep] = useState<FlowStepId>(1);

  const hasPremiumAccess = false;
  const userPlan: "free" | "premium" = hasPremiumAccess ? "premium" : "free";
  const isPremiumRequired = questionCount > FREE_PLAN_QUESTION_LIMIT && userPlan === "free";
  const premiumBoundaryPercent =
    ((PREMIUM_BOUNDARY_VALUE - MIN_QUESTION_COUNT) / (MAX_QUESTION_COUNT - MIN_QUESTION_COUNT)) * 100;
  const questionCountPercent =
    ((questionCount - MIN_QUESTION_COUNT) / (MAX_QUESTION_COUNT - MIN_QUESTION_COUNT)) * 100;
  const sliderTrackBackground =
    questionCount <= FREE_PLAN_QUESTION_LIMIT
      ? `linear-gradient(to right,
          var(--secondary) 0%,
          var(--secondary) ${questionCountPercent}%,
          var(--muted) ${questionCountPercent}%,
          var(--muted) calc(${premiumBoundaryPercent}% - 2px),
          var(--card) calc(${premiumBoundaryPercent}% - 2px),
          var(--card) calc(${premiumBoundaryPercent}% + 2px),
          var(--muted) calc(${premiumBoundaryPercent}% + 2px),
          var(--muted) 100%)`
      : `linear-gradient(to right,
          var(--secondary) 0%,
          var(--secondary) calc(${premiumBoundaryPercent}% - 2px),
          var(--card) calc(${premiumBoundaryPercent}% - 2px),
          var(--card) calc(${premiumBoundaryPercent}% + 2px),
          var(--primary) calc(${premiumBoundaryPercent}% + 2px),
          var(--primary) ${questionCountPercent}%,
          var(--muted) ${questionCountPercent}%,
          var(--muted) 100%)`;
  const sliderTrackStyle = {
    background: sliderTrackBackground,
  };
  const premiumHintPositionStyle =
    questionCountPercent >= 88
      ? { right: "0", left: "auto", transform: "translateX(0)" }
      : questionCountPercent <= 12
        ? { left: "0", right: "auto", transform: "translateX(0)" }
        : { left: `${questionCountPercent}%`, transform: "translateX(-50%)" };
  const canGenerate = analysisReady && !!file && !isGenerating;
  const canOpenStep2 = analysisReady;
  const canOpenStep3 = cards.length > 0;
  const isStep1Complete = Boolean(file);
  const isStep2Complete = cards.length > 0;
  const isStep3Complete = cards.length > 0;
  const step2Summary =
    cards.length > 0
      ? `Titel: ${title.trim() || "Unbenannt"} · Niveau: ${DIFFICULTY_LABELS[difficulty]} · Stil: ${LEARNING_GOAL_LABELS[learningGoal]}`
      : undefined;

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

  const navigateToLearnAfterSave = (target: string) => {
    router.replace(target);

    if (redirectFallbackTimer.current !== null) {
      window.clearTimeout(redirectFallbackTimer.current);
    }

    redirectFallbackTimer.current = window.setTimeout(() => {
      if (window.location.pathname.startsWith("/app/create")) {
        window.location.assign(target);
      }
    }, 1400);
  };
  const activeProcessingLabel = useMemo(() => {
    if (activeStage) {
      const stage = STAGE_DEFS.find((entry) => entry.key === activeStage);
      if (stage) return stage.label;
    }
    if (isDeriving) return "Unterlagen verwenden";
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

  const setQuestionCountWithHint = (nextValue: unknown) => {
    setQuestionCount((prev) => {
      const next = normalizeCount(nextValue);
      return next;
    });
  };

  const handleQuestionCountInputChange = (value: string) => {
    if (!/^\d*$/.test(value)) return;
    const numeric = Number(value);
    if (value && Number.isFinite(numeric) && numeric < MIN_QUESTION_COUNT) {
      setQuestionCountInput(String(MIN_QUESTION_COUNT));
      setQuestionCountWithHint(MIN_QUESTION_COUNT);
      return;
    }
    if (value && Number.isFinite(numeric) && numeric > MAX_QUESTION_COUNT) {
      setQuestionCountInput(String(MAX_QUESTION_COUNT));
      setQuestionCountWithHint(MAX_QUESTION_COUNT);
      return;
    }
    setQuestionCountInput(value);
    if (!value) return;
    setQuestionCountWithHint(value);
  };

  const handleQuestionCountInputBlur = () => {
    if (!questionCountInput) {
      setQuestionCountInput(String(questionCount));
      return;
    }
    const normalized = normalizeCount(questionCountInput);
    setQuestionCountWithHint(normalized);
    setQuestionCountInput(String(normalized));
  };

  const resetFlowForNewFile = (selectedFile: File | null) => {
    setFile(selectedFile);
    setFileName(selectedFile?.name ?? "");
    setAnalysisReady(false);
    setCards([]);
    setDetectedTopics([]);
    setTopicFocus("");
    setFocusOpen(false);
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
    const nextTopics = Array.isArray(payload.detectedTopics)
      ? payload.detectedTopics.slice(0, 6).map((topic) => String(topic))
      : [];

    setTitle(nextTitle);
    setDifficulty(nextDifficulty);
    setDetectedTopics(nextTopics);
    setFocusOpen(false);
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
      formData.append("style", styleFromLearningGoal(learningGoal));
      formData.append("difficulty", difficulty);
      formData.append("count", String(questionCount));
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
          learning_goal: learningGoal,
          difficulty,
          count: questionCount,
        });
      } else {
        trackEvent("regeneration_rate", {
          learning_goal: learningGoal,
          difficulty,
          count: questionCount,
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
    if (isPremiumRequired) {
      setShowPremiumModal(true);
      return;
    }
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

  const requestRefinedCard = async (
    card: CardDraft,
    action: RefineAction
  ): Promise<{ card?: CardDraft; error?: ApiErrorState }> => {
    const response = await fetch("/api/ai/refine-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: card.question.trim(),
        answer: card.answer.trim(),
        action,
        title,
        style: styleFromLearningGoal(learningGoal),
        difficulty,
        topicFocus,
      }),
    });

    if (!response.ok) {
      const parsed = await parseApiError(response, "Die Verfeinerung ist fehlgeschlagen.");
      return { error: parsed };
    }

    const payload = (await response.json()) as { card?: CardDraft };
    if (!payload.card) {
      return {
        error: {
          message: "Die Verfeinerung hat kein gültiges Ergebnis geliefert.",
          retryable: true,
        },
      };
    }

    return {
      card: {
        question: String(payload.card.question ?? "").trim(),
        answer: String(payload.card.answer ?? "").trim(),
      },
    };
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
      const result = await requestRefinedCard(card, action);
      if (result.error) {
        setActionError(result.error, undefined);
        return;
      }

      if (!result.card) {
        return;
      }

      setCards((prev) =>
        prev.map((entry, idx) =>
          idx === index
            ? {
                question: result.card?.question ?? "",
                answer: result.card?.answer ?? "",
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
      const payload = (await response.json()) as { deckId?: string };
      const nextDeckId = String(payload.deckId ?? "").trim();

      trackEvent("save_conversion_rate", {
        cards: cleaned.length,
        source: "create",
      });

      const target = nextDeckId
        ? `/app/learn?saved=1&newDeck=${encodeURIComponent(nextDeckId)}`
        : "/app/learn?saved=1";
      navigateToLearnAfterSave(target);
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
    setLearningGoal(cached.learningGoal);
    setDifficulty(cached.difficulty);
    setQuestionCount(cached.count);
    setTopicFocus(cached.topicFocus);
    setFocusOpen(Boolean(cached.topicFocus.trim()));
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
    setAnalysisReady(false);
    setDetectedTopics([]);
    setTopicFocus("");
    setFocusOpen(false);
    setError(null);
    setActiveStep(1);
    setTitle("");
    setLearningGoal("verstehen");
    setDifficulty("mittel");
    setQuestionCount(10);
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
        learningGoal,
        difficulty,
        count: questionCount,
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
    learningGoal,
    difficulty,
    questionCount,
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
        const payload = (await response.json()) as { deckId?: string };
        const nextDeckId = String(payload.deckId ?? "").trim();
        const target = nextDeckId
          ? `/app/learn?saved=1&newDeck=${encodeURIComponent(nextDeckId)}`
          : "/app/learn?saved=1";
        navigateToLearnAfterSave(target);
      } finally {
        setIsSaving(false);
      }
    };

    void autoSave();
  }, [user, router, cards.length, title]);

  useEffect(() => {
    setQuestionCountInput(String(questionCount));
  }, [questionCount]);

  useEffect(() => {
    router.prefetch("/app/learn");
  }, [router]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-refine-menu]")) {
        setOpenRefineMenuIndex(null);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenRefineMenuIndex(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!refineLoading) return;
    setOpenRefineMenuIndex(null);
  }, [refineLoading]);

  useEffect(() => {
    if (openRefineMenuIndex === null) return;
    if (openRefineMenuIndex < cards.length) return;
    setOpenRefineMenuIndex(null);
  }, [openRefineMenuIndex, cards.length]);

  useEffect(() => {
    return () => {
      if (redirectFallbackTimer.current !== null) {
        window.clearTimeout(redirectFallbackTimer.current);
      }
    };
  }, []);

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
      {showPremiumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-lg">
            <h3 className="text-base font-semibold text-foreground">Mehr Fragen mit Premium</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Mit Premium kannst du 11 bis 25 Fragen pro Lernset generieren.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setShowPremiumModal(false)}>
                Später
              </Button>
              <Button asChild>
                <Link href="/app/account#abo" onClick={() => setShowPremiumModal(false)}>
                  Upgrade ansehen
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="relative flex flex-col gap-6">
        <div ref={step1Ref}>
          <StepSection
            id={1}
            title="Datei auswählen"
            active={activeStep === 1}
            complete={isStep1Complete}
            disabled={activeStep > 1}
            onOpen={() => activeStep === 1 && goToStep(1)}
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
                className={`group flex w-full min-h-[136px] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed px-6 py-5 text-center transition-all duration-150 ${
                  isDragging
                    ? "scale-[1.01] border-primary/80 bg-background shadow-[0_0_0_2px_color-mix(in_srgb,var(--primary)_25%,transparent)]"
                    : "border-border/70 bg-background/70 hover:border-primary/50 hover:bg-background"
                }`}
                style={{ borderStyle: isDragging ? "solid" : undefined }}
              >
                <div className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background">
                  <ArrowUpTrayIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="text-base font-semibold text-foreground">Datei hochladen</span>
                <span className="text-xs text-muted-foreground">Per Drag &amp; Drop oder Klick auswählen</span>
                <span className="mt-1 text-[11px] text-muted-foreground">PDF, TXT, MD</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-background px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Datei</p>
                  <p className="text-sm font-semibold text-foreground">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    Größe: {file ? formatFileSize(file.size) : "nicht verfügbar"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-9 w-9 px-0 md:h-10 md:w-auto md:px-4"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ArrowsRightLeftIcon className="h-4 w-4" />
                    <span className="hidden md:inline">Datei wechseln</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 md:h-10 md:w-10"
                    onClick={() => resetFlowForNewFile(null)}
                  >
                    <TrashIcon className="h-4 w-4" />
                    <span className="sr-only">Datei entfernen</span>
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

            {activeStep === 1 && file && (
              <LoadingButton
                className="w-full md:w-auto"
                onClick={handlePrepare}
                disabled={!file || isDeriving}
                isLoading={isDeriving}
                loadingText="Analysiere"
                text="Unterlagen verwenden"
              />
            )}
          </StepSection>
        </div>

        <div ref={step2Ref}>
          <StepSection
            id={2}
            title="Wie möchtest du lernen?"
            subtitle={step2Summary}
            active={activeStep === 2}
            complete={isStep2Complete}
            disabled={!canOpenStep2 || activeStep > 2}
            onOpen={() => canOpenStep2 && activeStep <= 2 && goToStep(2)}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground">Titel</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none"
                  placeholder="Lernset-Titel"
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-muted-foreground">Lernziel</label>
                  <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-border bg-background p-1">
                    {Object.entries(LEARNING_GOAL_LABELS).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                          learningGoal === value
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-accent"
                        }`}
                        onClick={() => setLearningGoal(value as LearningGoalOption)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {LEARNING_GOAL_HINTS[learningGoal]}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-muted-foreground">Niveau</label>
                  <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-border bg-background p-1">
                    {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
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
                  <p className="text-xs text-muted-foreground">
                    {DIFFICULTY_HINTS[difficulty]}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-muted-foreground">Fragenanzahl</label>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={questionCountInput}
                      onChange={(event) => handleQuestionCountInputChange(event.target.value)}
                      onBlur={handleQuestionCountInputBlur}
                      className="h-8 w-14 rounded-md border border-border bg-background px-2 text-center text-sm font-semibold text-foreground focus:border-foreground/20 focus:outline-none"
                      aria-label="Fragenanzahl eingeben"
                    />
                    <span className="text-sm font-semibold text-foreground">Fragen</span>
                    {questionCount > FREE_PLAN_QUESTION_LIMIT && (
                      <img
                        src="/icons/premium-crown.svg"
                        alt="Premium"
                        width={16}
                        height={16}
                        className="h-4 w-4 text-primary"
                      />
                    )}
                  </div>
                  <div className="pt-1">
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2">
                        <div className="h-2 rounded-full" style={sliderTrackStyle} />
                      </div>
                      <input
                        type="range"
                        min={MIN_QUESTION_COUNT}
                        max={MAX_QUESTION_COUNT}
                        step={1}
                        value={questionCount}
                        data-premium={questionCount > FREE_PLAN_QUESTION_LIMIT ? "true" : "false"}
                        onChange={(event) => setQuestionCountWithHint(event.target.value)}
                        className="premium-range relative z-10 h-5 w-full cursor-pointer appearance-none bg-transparent"
                        aria-label="Fragenanzahl"
                      />
                      {questionCount > FREE_PLAN_QUESTION_LIMIT && (
                        <div
                          className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm"
                          style={premiumHintPositionStyle}
                        >
                          Mit Premium-Abo möglich
                        </div>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span>{MIN_QUESTION_COUNT}</span>
                      <span>{MAX_QUESTION_COUNT}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <details
                  className="rounded-xl bg-background py-3"
                  open={focusOpen}
                  onToggle={(event) => setFocusOpen(event.currentTarget.open)}
                >
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-foreground">
                    <span>Erweiterte Optionen</span>
                    <ChevronDownIcon
                      className={`h-4 w-4 transition-transform ${focusOpen ? "rotate-180" : ""}`}
                    />
                  </summary>
                  <div className="space-y-2 pt-3">
                    <p className="text-xs text-muted-foreground">
                      Ein Fokus lenkt die Fragen auf einen bestimmten Themenausschnitt.
                    </p>
                    <input
                      value={topicFocus}
                      onChange={(event) => setTopicFocus(event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none"
                      placeholder="z. B. Prüfungsfragen, Kernkonzepte"
                    />
                  </div>
                </details>
              </div>
            </div>

            {activeStep === 2 && (
              <LoadingButton
                className="mt-8 w-full min-w-[300px] md:w-auto"
                onClick={handleGenerate}
                disabled={!canGenerate}
                isLoading={isGenerating}
                loadingText="Generiere Fragen"
                text="Fragen generieren"
              />
            )}
          </StepSection>
        </div>

        <div ref={step3Ref}>
          <StepSection
            id={3}
            title="Lernset finalisieren"
            subtitle="Prüfe die Fragen und passe sie bei Bedarf an."
            active={activeStep === 3}
            complete={false}
            disabled={!canOpenStep3}
            onOpen={() => canOpenStep3 && goToStep(3)}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-muted-foreground">{cards.length} Karten</p>
            </div>

            <div className="space-y-7">
              {cards.map((card, index) => {
                const isRefining = refineLoading?.index === index;
                return (
                  <div
                    key={index}
                    className="space-y-3 rounded-2xl border border-border bg-background/80 p-3 md:p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">Karte {index + 1}</p>
                      <div className="flex items-center gap-2">
                        {isRefining ||
                        !card.question.trim() ||
                        !card.answer.trim() ? (
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled>
                            <SparklesIcon className="h-4 w-4" />
                            {isRefining ? "Verbessere…" : "Verbessern"}
                            <ChevronDownIcon className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <div className="relative" data-refine-menu>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenRefineMenuIndex((prev) => (prev === index ? null : index))
                              }
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground transition hover:bg-accent"
                            >
                              <SparklesIcon className="h-4 w-4" />
                              Verbessern
                              <ChevronDownIcon className="h-3.5 w-3.5" />
                            </button>
                            {openRefineMenuIndex === index && (
                              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                                {CARD_REFINE_OPTIONS.map((option) => (
                                  <button
                                    key={option.action}
                                    type="button"
                                    onClick={() => {
                                      setOpenRefineMenuIndex(null);
                                      void handleRefineCard(index, option.action);
                                    }}
                                    className="block w-full px-3 py-2 text-left text-xs text-foreground transition hover:bg-accent disabled:opacity-50"
                                    disabled={isRefining}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 border-border bg-background text-foreground hover:bg-accent"
                          onClick={() => handleRemoveCard(index)}
                          disabled={isRefining}
                        >
                          <TrashIcon className="h-4 w-4" />
                          <span className="sr-only">Karte entfernen</span>
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Frage
                      </label>
                      <input
                        value={card.question}
                        onChange={(event) => handleUpdateCard(index, "question", event.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none"
                        placeholder="Frage eingeben"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Antwort
                      </label>
                      <Textarea
                        rows={3}
                        value={card.answer}
                        onChange={(event) => handleUpdateCard(index, "answer", event.target.value)}
                        className="min-h-[96px] resize-y rounded-lg"
                        placeholder="Antwort eingeben"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" size="sm" onClick={handleAddCard}>
                Karte hinzufügen
              </Button>
            </div>

            <div className="pt-2">
              <LoadingButton
                className="w-full"
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
