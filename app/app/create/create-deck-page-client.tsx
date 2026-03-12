"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast/useToast";
import {
  ArrowUpTrayIcon,
  ChevronDownIcon,
  SparklesIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { clearHeroUpload, loadHeroUpload, saveHeroUpload } from "@/lib/hero-upload-store";

type CardDraft = {
  question: string;
  answer: string;
};

type SaveDraftPayload = {
  title: string;
  cards: CardDraft[];
  fileName?: string;
};

type DifficultyOption = "leicht" | "mittel" | "anspruchsvoll";
type LearningGoalOption = "verstehen" | "anwenden";
type ApiStyleOption = "kompakt" | "pruefungsnah" | "erklärend";
type QuestionCount = number;
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

type PlanTier = "free" | "premium" | "ultimate";
type LimitedValue = number | "unlimited";
type AccountBillingSnapshot = {
  plan: PlanTier;
  allPlanLimits: Record<
    PlanTier,
    {
      deckLimit: LimitedValue;
      questionsPerDeck: LimitedValue;
      speechSecondsPerDay: LimitedValue;
      aiRefine: boolean;
    }
  >;
  billing: {
    planLabels: Record<PlanTier, string>;
    text: {
      upgradeRequired: {
        decks: string;
        questions: string;
        explanationTime: string;
      };
      upgradeCallToAction: {
        premium: string;
        ultimate: string;
      };
    };
  };
};

const SAVE_DRAFT_KEY = "ttl:create-deck-draft";
const WORKING_DRAFT_KEY = "ttl:create-deck-working-draft";
const HERO_UPLOAD_SESSION_KEY = "ttl:hero-upload";
const MAX_UPLOAD_MB = 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const STAGE_DEFS: Array<{ key: StageKey; label: string }> = [
  { key: "analyze", label: "Unterlagen werden hochgeladen" },
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
const MIN_CARD_COUNT = 2;
const DEFAULT_MAX_QUESTION_COUNT = 100;
const QUESTION_COUNT_SCRUB_STEP_PX = 12;
const CARD_DELETE_ANIMATION_MS = 220;
const CARD_FEEDBACK_HIGHLIGHT_MS = 1600;
const TITLE_MAX_LENGTH = 45;
const FILE_MISSING_ERROR_MESSAGE =
  "Die Originaldatei ist nicht mehr verfügbar. Lade sie kurz neu hoch, um Fragen zu generieren.";
const CREATE_LOADER_VIDEO_SOURCES = [
  "/mascot/otter-reading.webm",
  "/mascot/otter-writing.webm",
  "/mascot/otter-saving.webm",
] as const;
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
  return value === "kompakt" || value === "pruefungsnah" || value === "erklärend";
}

function learningGoalFromStyle(value: unknown): LearningGoalOption {
  if (value === "pruefungsnah") return "anwenden";
  return "verstehen";
}

function styleFromLearningGoal(goal: LearningGoalOption): ApiStyleOption {
  return goal === "anwenden" ? "pruefungsnah" : "erklärend";
}

function normalizeCount(value: unknown, maxQuestionCount = DEFAULT_MAX_QUESTION_COUNT): QuestionCount {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MIN_QUESTION_COUNT;
  const rounded = Math.round(numeric);
  if (rounded < MIN_QUESTION_COUNT) return MIN_QUESTION_COUNT;
  if (rounded > maxQuestionCount) return maxQuestionCount;
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
                  <span className="inline-flex h-6 w-6 shrink-0 aspect-square items-center justify-center rounded-full border border-border text-xs font-semibold text-foreground">
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
          <span className="inline-flex h-7 w-7 shrink-0 aspect-square items-center justify-center rounded-full border border-border text-xs font-semibold text-foreground">
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
  const toast = useToast();
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
  const refinedHighlightTimer = useRef<number | null>(null);
  const deleteCardTimer = useRef<number | null>(null);
  const cardElementRefs = useRef<Array<HTMLDivElement | null>>([]);
  const allowNavigationRef = useRef(false);
  const titleLimitToastAtRef = useRef(0);
  const questionCountScrubRef = useRef<{
    pointerId: number;
    startX: number;
    startValue: number;
  } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isScrubbingQuestionCount, setIsScrubbingQuestionCount] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");

  const [title, setTitle] = useState("");
  const [learningGoal, setLearningGoal] = useState<LearningGoalOption>("verstehen");
  const [difficulty, setDifficulty] = useState<DifficultyOption>("mittel");
  const [questionCount, setQuestionCount] = useState<QuestionCount>(MIN_QUESTION_COUNT);
  const [questionCountInput, setQuestionCountInput] = useState(String(MIN_QUESTION_COUNT));
  const [topicFocus, setTopicFocus] = useState("");
  const [detectedTopics, setDetectedTopics] = useState<string[]>([]);
  const [focusOpen, setFocusOpen] = useState(false);

  const [cards, setCards] = useState<CardDraft[]>([]);
  const [cardFeedback, setCardFeedback] = useState<{ index: number; type: "success" | "error" } | null>(null);
  const [deletingCardIndex, setDeletingCardIndex] = useState<number | null>(null);
  const [deletingCardHeight, setDeletingCardHeight] = useState<number>(0);

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
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [pendingLeaveHref, setPendingLeaveHref] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<FlowStepId>(1);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const [billingSnapshot, setBillingSnapshot] = useState<AccountBillingSnapshot | null>(null);

  const numericLimit = (value: LimitedValue | undefined, fallback: number): number => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
    return fallback;
  };
  const freePlanCardLimitRaw = numericLimit(
    billingSnapshot?.allPlanLimits.free.questionsPerDeck,
    MIN_QUESTION_COUNT
  );
  const premiumPlanQuestionLimitRaw = numericLimit(
    billingSnapshot?.allPlanLimits.premium.questionsPerDeck,
    freePlanCardLimitRaw
  );
  const maxQuestionCount = Math.max(MIN_QUESTION_COUNT, premiumPlanQuestionLimitRaw);
  const freePlanCardLimit = Math.min(Math.max(MIN_QUESTION_COUNT, freePlanCardLimitRaw), maxQuestionCount);
  const maxCardCount = maxQuestionCount;
  const premiumBoundaryValue = Math.min(maxQuestionCount, freePlanCardLimit + 0.5);
  const userPlan: PlanTier = billingSnapshot?.plan ?? "free";
  const premiumPlanLabel = billingSnapshot?.billing.planLabels.premium ?? "Upgrade";
  const isPremiumRequired = questionCount > freePlanCardLimit && userPlan === "free";
  const questionRange = Math.max(1, maxQuestionCount - MIN_QUESTION_COUNT);
  const premiumBoundaryPercent =
    ((premiumBoundaryValue - MIN_QUESTION_COUNT) / questionRange) * 100;
  const questionCountPercent =
    ((questionCount - MIN_QUESTION_COUNT) / questionRange) * 100;
  const sliderTrackBackground =
    questionCount <= freePlanCardLimit
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
  const canOpenStep2 = analysisReady;
  const canOpenStep3 = cards.length > 0;
  const isStep1Complete = Boolean(file || fileName);
  const isStep2Complete = cards.length > 0;
  const isStep3Complete = cards.length > 0;
  const isTitleMissing = title.trim().length === 0;
  const isAtMinCardCount = cards.length <= MIN_CARD_COUNT;
  const isAtMaxCardCount = cards.length >= maxCardCount;
  const step1Summary = isStep1Complete && fileName ? `Datei: ${fileName}` : undefined;
  const step2Summary =
    cards.length > 0
      ? `Titel: ${title.trim() || "Unbenannt"} · Niveau: ${DIFFICULTY_LABELS[difficulty]} · Stil: ${LEARNING_GOAL_LABELS[learningGoal]}`
      : undefined;
  const hasUnsavedCreateDraft = (analysisReady || cards.length > 0) && !isSaving;

  useEffect(() => {
    let isCancelled = false;

    const loadBillingSnapshot = async () => {
      try {
        const response = await fetch("/api/account/dashboard", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as AccountBillingSnapshot;
        if (!isCancelled) {
          setBillingSnapshot(payload);
        }
      } catch {
        // Ignore billing snapshot failures and keep conservative defaults.
      }
    };

    void loadBillingSnapshot();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const clamped = normalizeCount(questionCount, maxQuestionCount);
    if (clamped !== questionCount) {
      setQuestionCount(clamped);
      setQuestionCountInput(String(clamped));
    }
  }, [maxQuestionCount, questionCount]);

  useEffect(() => {
    if (!billingSnapshot) return;
    if (questionCount !== MIN_QUESTION_COUNT || questionCountInput !== String(MIN_QUESTION_COUNT)) return;

    const initial = normalizeCount(freePlanCardLimit, maxQuestionCount);
    setQuestionCount(initial);
    setQuestionCountInput(String(initial));
  }, [billingSnapshot, freePlanCardLimit, maxQuestionCount, questionCount, questionCountInput]);

  const goToStep = useCallback((nextStep: FlowStepId) => {
    setActiveStep(nextStep);
    window.setTimeout(() => {
      const map: Record<FlowStepId, HTMLDivElement | null> = {
        1: step1Ref.current,
        2: step2Ref.current,
        3: step3Ref.current,
      };
      map[nextStep]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }, []);

  const navigateToLearnAfterSave = useCallback((target: string) => {
    allowNavigationRef.current = true;
    router.replace(target);

    if (redirectFallbackTimer.current !== null) {
      window.clearTimeout(redirectFallbackTimer.current);
    }

    redirectFallbackTimer.current = window.setTimeout(() => {
      if (window.location.pathname.startsWith("/app/create")) {
        window.location.assign(target);
      }
    }, 1400);
  }, [router]);
  const activeProcessingLabel = useMemo(() => {
    if (activeStage) {
      const stage = STAGE_DEFS.find((entry) => entry.key === activeStage);
      if (stage) return stage.label;
    }
    if (isDeriving) return "Unterlagen verwenden";
    if (isGenerating) return "Fragen generieren";
    if (isSaving) return "Lernset speichern";
    return "Verarbeite Anfrage";
  }, [activeStage, isDeriving, isGenerating, isSaving]);
  const loaderVideoSrc = isSaving
    ? "/mascot/otter-saving.webm"
    : isDeriving
      ? "/mascot/otter-reading.webm"
      : "/mascot/otter-writing.webm";

  const trackEvent = useCallback((event: string, payload: Record<string, unknown>) => {
    void fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, payload }),
      keepalive: true,
    }).catch(() => {
      // Analytics should never block UX.
    });
  }, []);

  const showErrorToast = useCallback((message: string, title = "Fehler") => {
    const safeMessage = String(message).trim();
    if (!safeMessage) return;
    toast.error(title, safeMessage);
  }, [toast]);

  const showApiErrorToast = useCallback((error: ApiErrorState, title = "Fehler") => {
    showErrorToast(error.message, title);
  }, [showErrorToast]);

  const setQuestionCountWithHint = (nextValue: unknown) => {
    setQuestionCount((prev) => {
      const next = normalizeCount(nextValue, maxQuestionCount);
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
    if (value && Number.isFinite(numeric) && numeric > maxQuestionCount) {
      setQuestionCountInput(String(maxQuestionCount));
      setQuestionCountWithHint(maxQuestionCount);
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
    const normalized = normalizeCount(questionCountInput, maxQuestionCount);
    setQuestionCountWithHint(normalized);
    setQuestionCountInput(String(normalized));
  };

  const handleTitleChange = (nextValue: string) => {
    if (nextValue.length <= TITLE_MAX_LENGTH) {
      setTitle(nextValue);
      return;
    }

    setTitle(nextValue.slice(0, TITLE_MAX_LENGTH));
    const now = Date.now();
    if (now - titleLimitToastAtRef.current < 1400) return;
    titleLimitToastAtRef.current = now;
    toast.info("Maximale Länge erreicht", `Titel darf maximal ${TITLE_MAX_LENGTH} Zeichen haben.`);
  };

  const handleQuestionCountScrubStart = (event: ReactPointerEvent<HTMLInputElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    questionCountScrubRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startValue: questionCount,
    };
    setIsScrubbingQuestionCount(false);
  };

  const handleQuestionCountScrubMove = (event: ReactPointerEvent<HTMLInputElement>) => {
    const scrub = questionCountScrubRef.current;
    if (!scrub || scrub.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - scrub.startX;
    const stepDelta = Math.trunc(deltaX / QUESTION_COUNT_SCRUB_STEP_PX);
    if (stepDelta === 0) return;
    if (!isScrubbingQuestionCount) {
      setIsScrubbingQuestionCount(true);
      event.currentTarget.blur();
    }
    const nextValue = normalizeCount(scrub.startValue + stepDelta, maxQuestionCount);
    setQuestionCountWithHint(nextValue);
    setQuestionCountInput(String(nextValue));
  };

  const stopQuestionCountScrub = (event: ReactPointerEvent<HTMLInputElement>) => {
    const scrub = questionCountScrubRef.current;
    if (!scrub || scrub.pointerId !== event.pointerId) return;
    questionCountScrubRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsScrubbingQuestionCount(false);
  };

  const resetFlowForNewFile = useCallback((selectedFile: File | null) => {
    setFile(selectedFile);
    setFileName(selectedFile?.name ?? "");
    setAnalysisReady(false);
    setCards([]);
    setDetectedTopics([]);
    setTopicFocus("");
    setFocusOpen(false);
    setActiveStep(1);
  }, []);

  const hydrateFromDerive = useCallback((payload: DeriveResponse) => {
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
  }, []);

  const handlePrepare = useCallback(async (selectedFile?: File | null) => {
    const fileToPrepare = selectedFile ?? file;
    if (!fileToPrepare) {
      toast.info("Datei fehlt", "Bitte wähle zuerst eine Datei aus.");
      return;
    }

    setIsDeriving(true);
    setLoaderOpen(true);
    setActiveStage("analyze");

    try {
      const formData = new FormData();
      formData.append("file", fileToPrepare);

      const response = await fetch("/api/ai/derive-file", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const parsed = await parseApiError(response, "Die Dokumentanalyse ist fehlgeschlagen.");
        showApiErrorToast(parsed, "Analyse fehlgeschlagen");
        return;
      }

      setActiveStage("topics");

      const payload = (await response.json()) as DeriveResponse;
      hydrateFromDerive(payload);
      await delay(220);

      setAnalysisReady(true);
      goToStep(2);
      toast.addToast({
        type: "success",
        title: "Datei hochgeladen",
        message: "Deine Unterlagen wurden erfolgreich verarbeitet.",
        durationMs: 5500,
      });
      trackEvent("derive_completed", {
        detected_topics_count: payload.detectedTopics?.length ?? 0,
      });
    } catch {
      toast.error(
        "Analyse fehlgeschlagen",
        "Unerwarteter Fehler beim Verarbeiten der Datei. Bitte versuche es erneut."
      );
    } finally {
      setIsDeriving(false);
      setActiveStage(null);
      setLoaderOpen(false);
    }
  }, [file, goToStep, hydrateFromDerive, showApiErrorToast, toast, trackEvent]);

  const consumeFile = useCallback((selectedFile: File | null, options?: { persist?: boolean }) => {
    if (!selectedFile) return;
    if (isDeriving) return;
    if (!isAllowedFile(selectedFile)) {
      toast.error("Upload fehlgeschlagen", "Bitte lade eine PDF-, TXT- oder MD-Datei hoch.");
      return;
    }
    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      toast.error(
        "Upload fehlgeschlagen",
        `Die Datei ist größer als ${MAX_UPLOAD_MB}MB. Komprimiere sie bitte, oder verwende eine andere.`
      );
      return;
    }

    if (options?.persist !== false) {
      void saveHeroUpload(selectedFile).catch(() => {
        // Ignore cache write failures and continue with the upload flow.
      });
    }

    resetFlowForNewFile(selectedFile);
    void handlePrepare(selectedFile);
  }, [handlePrepare, isDeriving, resetFlowForNewFile, toast]);

  const runGeneration = async (action: "generate" | "regenerate", sourceFile: File | null) => {
    if (!sourceFile) {
      toast.error("Datei nicht verfügbar", FILE_MISSING_ERROR_MESSAGE);
      return;
    }

    setIsGenerating(true);
    setLoaderOpen(true);
    setActiveStage("generate");
    generateStartedAt.current = performance.now();

    try {
      const formData = new FormData();
      formData.append("file", sourceFile);
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
        showApiErrorToast(parsed, "Generierung fehlgeschlagen");
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
        toast.error(
          "Keine Fragen erzeugt",
          "Es konnten keine brauchbaren Fragen erzeugt werden. Bitte erneut versuchen."
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
      if (action === "generate") {
        toast.success("Fragen generiert", `${nextCards.length} Fragen wurden erstellt.`);
      } else {
        toast.success("Fragen aktualisiert", `${nextCards.length} Fragen wurden neu erstellt.`);
      }

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
    } catch {
      toast.error(
        "Generierung fehlgeschlagen",
        "Unerwarteter Fehler bei der Fragengenerierung. Bitte versuche es erneut."
      );
    } finally {
      setIsGenerating(false);
      setActiveStage(null);
      setLoaderOpen(false);
    }
  };

  const validateGenerationBeforeSubmit = (sourceFile: File | null): sourceFile is File => {
    if (isGenerating || isDeriving) {
      toast.info("Bitte warten", "Unterlagen werden hochgeladen. Bitte kurz warten.");
      return false;
    }

    if (!sourceFile) {
      toast.error("Datei nicht verfügbar", FILE_MISSING_ERROR_MESSAGE);
      return false;
    }

    if (!isAllowedFile(sourceFile)) {
      toast.error("Ungültige Datei", "Bitte lade eine PDF-, TXT- oder MD-Datei hoch.");
      return false;
    }

    if (sourceFile.size > MAX_UPLOAD_BYTES) {
      toast.error(
        "Datei zu groß",
        `Die Datei ist größer als ${MAX_UPLOAD_MB}MB. Komprimiere sie bitte, oder verwende eine andere.`
      );
      return false;
    }

    if (!analysisReady) {
      toast.info("Analyse fehlt", "Bitte lade zuerst Unterlagen hoch, bevor du Fragen generierst.");
      return false;
    }

    if (!title.trim()) {
      toast.info("Titel fehlt", "Bitte lege einen Titel fest, bevor du Fragen generierst.");
      return false;
    }

    const normalizedCount = normalizeCount(questionCountInput || questionCount, maxQuestionCount);
    setQuestionCountWithHint(normalizedCount);
    setQuestionCountInput(String(normalizedCount));
    return true;
  };

  const ensureGenerationFile = async (): Promise<File | null> => {
    if (file) return file;

    const restored = await loadHeroUpload();
    if (!restored) return null;
    if (fileName && restored.name !== fileName) return null;

    setFile(restored);
    if (!fileName) {
      setFileName(restored.name);
    }
    return restored;
  };

  const handleGenerate = async () => {
    const sourceFile = await ensureGenerationFile();
    if (!validateGenerationBeforeSubmit(sourceFile)) return;
    if (isPremiumRequired) {
      setShowPremiumModal(true);
      return;
    }
    await runGeneration("generate", sourceFile);
  };

  const handleRegenerate = async () => {
    const sourceFile = await ensureGenerationFile();
    if (!validateGenerationBeforeSubmit(sourceFile)) return;
    if (isPremiumRequired) {
      setShowPremiumModal(true);
      return;
    }
    await runGeneration("regenerate", sourceFile);
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
    if (userPlan === "free" && cards.length >= freePlanCardLimit) {
      setShowPremiumModal(true);
      return;
    }
    if (isAtMaxCardCount) {
      toast.info("Maximum erreicht", `Ein Lernset kann maximal ${maxCardCount} Fragen enthalten.`);
      return;
    }
    const lastCard = cards[cards.length - 1];
    if (lastCard && !lastCard.question.trim() && !lastCard.answer.trim()) {
      return;
    }
    setCards((prev) => [...prev, { question: "", answer: "" }]);
  };

  const handleRemoveCard = (index: number) => {
    if (isAtMinCardCount) {
      const cardElement = cardElementRefs.current[index];
      if (cardElement) {
        cardElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      if (refinedHighlightTimer.current !== null) {
        window.clearTimeout(refinedHighlightTimer.current);
      }
      setCardFeedback({ index, type: "error" });
      refinedHighlightTimer.current = window.setTimeout(() => {
        setCardFeedback(null);
        refinedHighlightTimer.current = null;
      }, CARD_FEEDBACK_HIGHLIGHT_MS);
      toast.error("Löschen nicht möglich", `Mindestens ${MIN_CARD_COUNT} Fragen sind erforderlich.`);
      return;
    }
    if (deletingCardIndex !== null) return;

    const cardElement = cardElementRefs.current[index];
    const measuredHeight = cardElement?.offsetHeight ?? 0;
    setDeletingCardHeight(measuredHeight);
    setDeletingCardIndex(index);
    setOpenRefineMenuIndex((prev) => (prev === index ? null : prev));

    if (deleteCardTimer.current !== null) {
      window.clearTimeout(deleteCardTimer.current);
    }

    deleteCardTimer.current = window.setTimeout(() => {
      setCards((prev) => prev.filter((_, idx) => idx !== index));
      setCardFeedback((prev) => {
        if (prev === null) return prev;
        if (prev.index === index) return null;
        if (prev.index > index) {
          return { ...prev, index: prev.index - 1 };
        }
        return prev;
      });
      setOpenRefineMenuIndex((prev) => {
        if (prev === null) return prev;
        if (prev === index) return null;
        if (prev > index) return prev - 1;
        return prev;
      });
      setDeletingCardIndex(null);
      setDeletingCardHeight(0);
      deleteCardTimer.current = null;
      toast.info("Karte entfernt", "Die Frage wurde aus dem Lernset entfernt.");
    }, CARD_DELETE_ANIMATION_MS);
  };

  const requestRefinedCard = async (
    card: CardDraft,
    action: RefineAction
  ): Promise<{ card?: CardDraft; error?: ApiErrorState }> => {
    try {
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
    } catch {
      return {
        error: {
          message: "Unerwarteter Fehler bei der Verfeinerung. Bitte erneut versuchen.",
          retryable: true,
        },
      };
    }
  };

  const handleRefineCard = async (index: number, action: RefineAction) => {
    const card = cards[index];
    if (!card) return;
    const question = card.question.trim();
    const answer = card.answer.trim();
    if (!question || !answer) {
      toast.info(
        "Inhalt fehlt",
        "Bitte zuerst Frage und Antwort ausfüllen, dann kann die Antwort verfeinert werden."
      );
      return;
    }

    setRefineLoading({ index, action });

    try {
      const result = await requestRefinedCard(card, action);
      if (result.error) {
        showApiErrorToast(result.error, "Verfeinerung fehlgeschlagen");
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

      const refinedCardElement = cardElementRefs.current[index];
      if (refinedCardElement) {
        refinedCardElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }

      if (refinedHighlightTimer.current !== null) {
        window.clearTimeout(refinedHighlightTimer.current);
      }
      setCardFeedback({ index, type: "success" });
      refinedHighlightTimer.current = window.setTimeout(() => {
        setCardFeedback(null);
        refinedHighlightTimer.current = null;
      }, CARD_FEEDBACK_HIGHLIGHT_MS);
      toast.success("Karte verbessert", "Die ausgewählte Karte wurde aktualisiert.");
      trackEvent("card_refined", { action });
    } finally {
      setRefineLoading(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const cleaned = cards
        .map((card) => ({
          question: card.question.trim(),
          answer: card.answer.trim(),
        }))
        .filter((card) => card.question && card.answer);

      if (cleaned.length === 0) {
        toast.info("Keine Karten", "Bitte mindestens eine Frage mit Antwort anlegen.");
        return;
      }

      const finalTitle = title.trim() || fileName.replace(/\.[^.]+$/, "") || "Lernset";

      if (!user) {
        toast.info("Login erforderlich", "Zum Speichern bitte kurz anmelden.");
        saveLoginDraft({
          title: finalTitle,
          cards: cleaned,
          fileName: fileName.trim() || undefined,
        });
        allowNavigationRef.current = true;
        router.push("/auth/sign-in?callbackUrl=/app/create");
        return;
      }

      const response = await fetch("/api/ai/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: finalTitle,
          cards: cleaned,
          fileName: fileName.trim() || undefined,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.info("Login erforderlich", "Zum Speichern bitte kurz anmelden.");
          saveLoginDraft({
            title: finalTitle,
            cards: cleaned,
            fileName: fileName.trim() || undefined,
          });
          allowNavigationRef.current = true;
          router.push("/auth/sign-in?callbackUrl=/app/create");
          return;
        }

        const parsed = await parseApiError(response, "Speichern fehlgeschlagen.");
        showApiErrorToast(parsed, "Speichern fehlgeschlagen");
        return;
      }

      clearLoginDraft();
      clearWorkingDraft();
      void clearHeroUpload().catch(() => {
        // Ignore cache cleanup failures.
      });
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
    } catch {
      toast.error("Speichern fehlgeschlagen", "Unerwarteter Fehler beim Speichern. Bitte erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (forceNewFlow) {
      setIsDraftHydrated(true);
      return;
    }

    const cached = loadWorkingDraft();
    if (!cached) {
      setIsDraftHydrated(true);
      return;
    }

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
    setIsDraftHydrated(true);
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
    setActiveStep(1);
    setTitle("");
    setLearningGoal("verstehen");
    setDifficulty("mittel");
    setQuestionCount(freePlanCardLimit);
    setQuestionCountInput(String(freePlanCardLimit));
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
  }, [forceNewFlow, freePlanCardLimit, router]);

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
    if (file || !isDraftHydrated) return;

    let active = true;
    const fetchUpload = async () => {
      const fromSession = decodeHeroUploadFromSession();
      if (fromSession && active) {
        consumeFile(fromSession);
        return;
      }

      if (!analysisReady && !fileName.trim()) return;
      const uploaded = await loadHeroUpload();
      if (!active || !uploaded) return;
      if (fileName && uploaded.name !== fileName) return;

      if (analysisReady) {
        setFile(uploaded);
        if (!fileName) {
          setFileName(uploaded.name);
        }
        return;
      }

      consumeFile(uploaded, { persist: false });
    };

    void fetchUpload();
    return () => {
      active = false;
    };
  }, [file, isDraftHydrated, analysisReady, fileName, consumeFile]);

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

      try {
        const response = await fetch("/api/ai/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draft.title,
            cards: draft.cards,
            fileName: draft.fileName,
          }),
        });

        if (!response.ok) {
          const parsed = await parseApiError(response, "Speichern fehlgeschlagen.");
          showApiErrorToast(parsed, "Speichern fehlgeschlagen");
          return;
        }

        clearLoginDraft();
        clearWorkingDraft();
        void clearHeroUpload().catch(() => {
          // Ignore cache cleanup failures.
        });
        const payload = (await response.json()) as { deckId?: string };
        const nextDeckId = String(payload.deckId ?? "").trim();
        const target = nextDeckId
          ? `/app/learn?saved=1&newDeck=${encodeURIComponent(nextDeckId)}`
          : "/app/learn?saved=1";
        navigateToLearnAfterSave(target);
      } catch {
        toast.error("Speichern fehlgeschlagen", "Unerwarteter Fehler beim Speichern. Bitte erneut versuchen.");
      } finally {
        setIsSaving(false);
      }
    };

    void autoSave();
  }, [user, cards.length, title, navigateToLearnAfterSave, showApiErrorToast, toast]);

  useEffect(() => {
    setQuestionCountInput(String(questionCount));
  }, [questionCount]);

  useEffect(() => {
    router.prefetch("/app/learn");
  }, [router]);

  useEffect(() => {
    for (const src of CREATE_LOADER_VIDEO_SOURCES) {
      const selector = `link[rel=\"preload\"][as=\"video\"][href=\"${src}\"]`;
      if (document.head.querySelector(selector)) continue;
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "video";
      link.href = src;
      link.type = "video/webm";
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!hasUnsavedCreateDraft || allowNavigationRef.current) return;
      if (showLeaveConfirmModal) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr) return;
      if (hrefAttr.startsWith("#")) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);

      const isSameLocation =
        nextUrl.origin === currentUrl.origin &&
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        nextUrl.hash === currentUrl.hash;

      if (isSameLocation) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingLeaveHref(nextUrl.toString());
      setShowLeaveConfirmModal(true);
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasUnsavedCreateDraft, showLeaveConfirmModal]);

  const handleCancelLeave = () => {
    setShowLeaveConfirmModal(false);
    setPendingLeaveHref(null);
  };

  const handleConfirmLeave = () => {
    if (!pendingLeaveHref) {
      setShowLeaveConfirmModal(false);
      return;
    }

    allowNavigationRef.current = true;
    const target = pendingLeaveHref;
    setShowLeaveConfirmModal(false);
    setPendingLeaveHref(null);
    window.location.assign(target);
  };

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
      if (refinedHighlightTimer.current !== null) {
        window.clearTimeout(refinedHighlightTimer.current);
      }
      if (deleteCardTimer.current !== null) {
        window.clearTimeout(deleteCardTimer.current);
      }
    };
  }, []);

  return (
    <main className="relative py-8">
      {(loaderOpen || isSaving) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card px-6 py-6 text-center shadow-sm">
            <p className="text-base font-semibold text-foreground">{activeProcessingLabel}</p>
            <div className="mt-4 flex justify-center">
              <video
                key={loaderVideoSrc}
                className="h-[9rem] w-[9rem] object-contain"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
              >
                <source src={loaderVideoSrc} type="video/webm" />
              </video>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Bitte kurz warten…</p>
          </div>
        </div>
      )}
      {showLeaveConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-lg">
            <h3 className="text-base font-semibold text-foreground">Änderungen verwerfen?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Dein Lernset ist noch nicht gespeichert. Möchtest du die Seite wirklich verlassen?
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="outline" onClick={handleCancelLeave} className="w-full whitespace-normal">
                Auf der Seite bleiben
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmLeave}
                className="w-full whitespace-normal text-background hover:text-background"
              >
                Ohne Speichern verlassen
              </Button>
            </div>
          </div>
        </div>
      )}
      {showPremiumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-lg">
            <h3 className="text-base font-semibold text-foreground">Mehr Fragen mit {premiumPlanLabel}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Mit {premiumPlanLabel} kannst du mehr als {freePlanCardLimit} Fragen pro Lernset generieren.
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
            subtitle={step1Summary}
            active={activeStep === 1}
            complete={isStep1Complete}
            disabled={activeStep > 1}
            onOpen={() => activeStep === 1 && goToStep(1)}
          >
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

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={(event) => {
                consumeFile(event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
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
                  onChange={(event) => handleTitleChange(event.target.value)}
                  className={`w-full rounded-xl border bg-background px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none ${
                    isTitleMissing
                      ? "border-destructive focus:border-destructive"
                      : "border-border focus:border-foreground/20"
                  }`}
                  placeholder="Lernset-Titel"
                />
                {isTitleMissing && (
                  <p className="text-xs text-destructive">Bitte einen Titel festlegen.</p>
                )}
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
                      onPointerDown={handleQuestionCountScrubStart}
                      onPointerMove={handleQuestionCountScrubMove}
                      onPointerUp={stopQuestionCountScrub}
                      onPointerCancel={stopQuestionCountScrub}
                      onLostPointerCapture={stopQuestionCountScrub}
                      className={`h-8 w-14 rounded-md border border-border bg-background px-2 text-center text-sm font-semibold text-foreground focus:border-foreground/20 focus:outline-none ${
                        isScrubbingQuestionCount ? "cursor-grabbing select-none" : "cursor-ew-resize"
                      }`}
                      aria-label="Fragenanzahl eingeben"
                      title="Tippen oder horizontal ziehen"
                    />
                    <span className="text-sm font-semibold text-foreground">Fragen</span>
                    {questionCount > freePlanCardLimit && (
                      <Image
                        src="/icons/premium-crown.svg"
                        alt={premiumPlanLabel}
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
                        max={maxQuestionCount}
                        step={1}
                        value={questionCount}
                        data-premium={questionCount > freePlanCardLimit ? "true" : "false"}
                        onChange={(event) => setQuestionCountWithHint(event.target.value)}
                        className="premium-range relative z-10 h-5 w-full cursor-pointer appearance-none bg-transparent"
                        aria-label="Fragenanzahl"
                      />
                      {questionCount > freePlanCardLimit && (
                        <div
                          className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm"
                          style={premiumHintPositionStyle}
                        >
                          Mit {premiumPlanLabel}-Abo möglich
                        </div>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span>{MIN_QUESTION_COUNT}</span>
                      <span>{maxQuestionCount}</span>
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
                    <span className="text-muted-foreground">Erweiterte Optionen</span>
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
                disabled={isGenerating || isDeriving || isTitleMissing}
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

            <div className="flex flex-col">
              {cards.map((card, index) => {
                const isRefining = refineLoading?.index === index;
                const isDeleting = deletingCardIndex === index;
                const cardFeedbackType = cardFeedback?.index === index ? cardFeedback.type : null;
                const feedbackColorVar =
                  cardFeedbackType === "error" ? "var(--color-error)" : "var(--color-success)";
                return (
                  <div
                    key={index}
                    ref={(element) => {
                      cardElementRefs.current[index] = element;
                    }}
                    data-create-card="true"
                    className={`mb-8 space-y-5 rounded-2xl border bg-card/95 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_6px_16px_rgba(0,0,0,0.14)] transition-all duration-300 last:mb-0 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.16)] md:p-5 dark:bg-[color-mix(in_srgb,var(--card)_90%,var(--muted)_10%)] ${
                      cardFeedbackType
                        ? ""
                        : "border-border"
                    } ${isDeleting ? "isDeleting pointer-events-none" : ""}`}
                    style={{
                      ...(cardFeedbackType
                        ? {
                            backgroundColor: `color-mix(in srgb, ${feedbackColorVar} 14%, var(--color-card))`,
                            borderColor: `color-mix(in srgb, ${feedbackColorVar} 30%, var(--color-border))`,
                            boxShadow:
                              `0 0 0 2px color-mix(in srgb, ${feedbackColorVar} 45%, transparent), 0 10px 24px rgba(0,0,0,0.16)`,
                          }
                        : {}),
                      ...(isDeleting
                        ? {
                            ["--delete-start-height" as string]: `${Math.max(deletingCardHeight, 1)}px`,
                          }
                        : {}),
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-xs font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {isRefining ||
                        !card.question.trim() ||
                        !card.answer.trim() ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 border-white/10 bg-muted/40 text-xs text-foreground hover:bg-muted/55 dark:border-white/10 dark:bg-[color-mix(in_srgb,var(--muted)_65%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--muted)_78%,transparent)]"
                            disabled
                          >
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
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-muted/40 px-3 text-xs font-medium text-foreground transition hover:bg-muted/55 dark:border-white/10 dark:bg-[color-mix(in_srgb,var(--muted)_65%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--muted)_78%,transparent)]"
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
                          className="h-8 w-8 border-white/10 bg-muted/35 text-muted-foreground hover:bg-muted/55 hover:text-foreground dark:border-white/10 dark:bg-[color-mix(in_srgb,var(--muted)_58%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--muted)_72%,transparent)]"
                          onClick={() => handleRemoveCard(index)}
                          disabled={isRefining || deletingCardIndex !== null}
                        >
                          <TrashIcon className="h-4 w-4" />
                          <span className="sr-only">Karte entfernen</span>
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-medium text-muted-foreground/85">
                          Frage
                        </label>
                        <input
                          value={card.question}
                          onChange={(event) => handleUpdateCard(index, "question", event.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none sm:text-sm"
                          placeholder="Frage eingeben"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-medium text-muted-foreground/85">
                          Antwort
                        </label>
                        <Textarea
                          rows={3}
                          value={card.answer}
                          onChange={(event) => handleUpdateCard(index, "answer", event.target.value)}
                          className="min-h-[96px] resize-y rounded-xl border-white/10 !bg-transparent text-xs transition-colors focus:border-primary sm:text-sm"
                          placeholder="Antwort eingeben"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 bg-muted/35 hover:bg-muted/55 dark:border-white/10 dark:bg-[color-mix(in_srgb,var(--muted)_58%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--muted)_72%,transparent)]"
                onClick={handleAddCard}
                disabled={isAtMaxCardCount || deletingCardIndex !== null}
              >
                Karte hinzufügen
              </Button>
            </div>

            <LoadingButton
              className="mt-8 w-full min-w-[300px] md:w-auto"
              onClick={handleSave}
              disabled={isSaving}
              isLoading={isSaving}
              loadingText="Speichere"
              text="Lernset speichern"
            />
            {!user && (
              <p className="text-sm text-muted-foreground">
                Zum Speichern wird ein kostenloser Account benötigt.
              </p>
            )}
          </StepSection>
        </div>

      </div>
    </main>
  );
}
