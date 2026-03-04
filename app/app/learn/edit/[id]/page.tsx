"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast/useToast";
import { ArrowPathIcon, ChevronDownIcon, SparklesIcon, TrashIcon } from "@heroicons/react/24/outline";

const EMPTY_CARD = { question: "", answer: "" };

type CardDraft = {
  id?: string;
  question: string;
  answer: string;
};

type DeckPayload = {
  id: string;
  title: string;
  hasBeenIntroduced: boolean;
  learningPhase: "intro" | "scaffolded" | "free";
  cards: CardDraft[];
};

type LearningStageOption = "intro" | "scaffolded" | "free";
type ProgressStats = {
  known: number;
  learning: number;
  new: number;
};
type ProgressPayload = {
  stats?: Partial<ProgressStats>;
  learningPhase?: LearningStageOption;
  learningStage?: LearningStageOption;
};

type FormSnapshot = {
  title: string;
  cards: CardDraft[];
};

type RefineAction =
  | "expandAnswer"
  | "condenseAnswer"
  | "increaseDifficulty"
  | "simplifyAnswer"
  | "examOriented";

const CARD_REFINE_OPTIONS: Array<{ action: RefineAction; label: string }> = [
  { action: "expandAnswer", label: "Ausführlicher" },
  { action: "condenseAnswer", label: "Prägnanter" },
  { action: "increaseDifficulty", label: "Schwieriger" },
  { action: "simplifyAnswer", label: "Vereinfachen" },
];
const CARD_DELETE_ANIMATION_MS = 220;
const MIN_CARD_COUNT = 2;
const FREE_PLAN_CARD_LIMIT = 10;

type PremiumModalReason = "refine" | "cardLimit";
const LEARNING_STAGE_OPTIONS: Array<{
  value: LearningStageOption;
  label: string;
  hint: string;
}> = [
  { value: "intro", label: "Einführung", hint: "Frage und Lösung gemeinsam ansehen." },
  { value: "scaffolded", label: "Üben", hint: "Lösung in eigenen Worten erklären." },
  { value: "free", label: "Erklären", hint: "Nur mit der Frage frei erklären." },
];

function cloneCards(cards: CardDraft[]): CardDraft[] {
  return cards.map((card) => ({
    id: card.id,
    question: card.question,
    answer: card.answer,
  }));
}

function areCardsEqual(left: CardDraft[], right: CardDraft[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftCard = left[index];
    const rightCard = right[index];
    if (leftCard.id !== rightCard.id) return false;
    if (leftCard.question !== rightCard.question) return false;
    if (leftCard.answer !== rightCard.answer) return false;
  }
  return true;
}

export default function EditDeckPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [cards, setCards] = useState<CardDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [learningStage, setLearningStage] = useState<LearningStageOption>("intro");
  const [savedLearningStage, setSavedLearningStage] = useState<LearningStageOption>("intro");
  const [learningStageDraft, setLearningStageDraft] = useState<LearningStageOption>("intro");
  const [savedFormSnapshot, setSavedFormSnapshot] = useState<FormSnapshot | null>(null);
  const [isSaveBarMounted, setIsSaveBarMounted] = useState(false);
  const [isSaveBarVisible, setIsSaveBarVisible] = useState(false);
  const [isLearningStageEditorOpen, setIsLearningStageEditorOpen] = useState(false);
  const [progressStats, setProgressStats] = useState<ProgressStats>({ known: 0, learning: 0, new: 0 });
  const [isApplyingLearningStage, setIsApplyingLearningStage] = useState(false);
  const [isDeletingDeck, setIsDeletingDeck] = useState(false);
  const [openRefineMenuIndex, setOpenRefineMenuIndex] = useState<number | null>(null);
  const [refineLoading, setRefineLoading] = useState<{ index: number; action: RefineAction } | null>(null);
  const [deletingCardIndex, setDeletingCardIndex] = useState<number | null>(null);
  const [deletingCardHeight, setDeletingCardHeight] = useState<number>(0);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showResetProgressModal, setShowResetProgressModal] = useState(false);
  const [showDeleteDeckModal, setShowDeleteDeckModal] = useState(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [pendingLeaveHref, setPendingLeaveHref] = useState<string | null>(null);
  const [premiumModalReason, setPremiumModalReason] = useState<PremiumModalReason>("refine");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const cardElementRefs = useRef<Array<HTMLDivElement | null>>([]);
  const deleteCardTimer = useRef<number | null>(null);
  const saveBarExitTimer = useRef<number | null>(null);
  const allowNavigationRef = useRef(false);
  const hasPremiumAccess = false;

  const deckId = useMemo(() => {
    const raw = params?.id;
    return typeof raw === "string" ? decodeURIComponent(raw) : "";
  }, [params?.id]);

  const getPhaseMeta = (phase: LearningStageOption) => {
    if (phase === "intro") {
      return {
        label: "Einführung",
        className: "bg-accent text-foreground",
      };
    }

    if (phase === "scaffolded") {
      return {
        label: "Üben",
        className: "bg-accent text-foreground",
      };
    }

    return {
      label: "Erklären",
      className: "bg-accent text-foreground",
    };
  };

  const refreshProgress = useCallback(async (targetDeckId: string) => {
    try {
      const response = await fetch(`/api/progress?deckId=${encodeURIComponent(targetDeckId)}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load progress");
      }
      const payload = (await response.json()) as ProgressPayload;
      const nextStats: ProgressStats = {
        known: Number(payload.stats?.known ?? 0),
        learning: Number(payload.stats?.learning ?? 0),
        new: Number(payload.stats?.new ?? 0),
      };
      setProgressStats(nextStats);
      const nextStage = payload.learningStage ?? payload.learningPhase ?? "intro";
      setSavedLearningStage(nextStage);
      setLearningStageDraft(nextStage);
    } catch (progressError) {
      console.error(progressError);
    }
  }, []);

  useEffect(() => {
    if (!deckId) return;
    const loadDeck = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/decks/${encodeURIComponent(deckId)}`);
        if (!response.ok) {
          throw new Error("Failed to load learning set");
        }
        const data = (await response.json()) as DeckPayload;
        setTitle(data.title ?? "");
        setCards(data.cards ?? []);
        const nextStage: LearningStageOption =
          !data.hasBeenIntroduced || data.learningPhase === "intro"
            ? "intro"
            : data.learningPhase === "free"
              ? "free"
              : "scaffolded";
        setSavedLearningStage(nextStage);
        setLearningStage(nextStage);
        setLearningStageDraft(nextStage);
        setSavedFormSnapshot({
          title: data.title ?? "",
          cards: cloneCards(data.cards ?? []),
        });
        setIsLearningStageEditorOpen(false);
        await refreshProgress(deckId);
      } catch (err) {
        console.error(err);
        setError("Lernset konnte nicht geladen werden.");
      } finally {
        setIsLoading(false);
      }
    };

    loadDeck();
  }, [deckId, refreshProgress]);

  const handleUpdateCard = (index: number, field: "question" | "answer", value: string) => {
    setCards((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddCard = () => {
    if (deletingCardIndex !== null) return;
    if (!hasPremiumAccess && cards.length >= FREE_PLAN_CARD_LIMIT) {
      setPremiumModalReason("cardLimit");
      setShowPremiumModal(true);
      return;
    }
    setCards((prev) => {
      const lastCard = prev[prev.length - 1];
      if (lastCard && !lastCard.question.trim() && !lastCard.answer.trim()) {
        return prev;
      }
      return [...prev, { ...EMPTY_CARD }];
    });
  };

  const handleRemoveCard = (index: number) => {
    if (cards.length <= MIN_CARD_COUNT) {
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

  const handleSave = async () => {
    if (!deckId || savedFormSnapshot === null) return;
    const stageChanged = learningStage !== savedLearningStage;
    const contentChanged =
      title !== savedFormSnapshot.title || !areCardsEqual(cards, savedFormSnapshot.cards);
    if (!stageChanged && !contentChanged) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    let normalizedTitle = title;
    let normalizedCards = cloneCards(cards);
    if (contentChanged) {
      const cleanedCards = cards
        .map((card) => ({
          id: card.id,
          question: card.question.trim(),
          answer: card.answer.trim(),
        }))
        .filter((card) => card.question && card.answer);

      if (!title.trim() || cleanedCards.length === 0) {
        setIsSaving(false);
        setError("Titel und mindestens eine Karte sind erforderlich.");
        return;
      }

      normalizedTitle = title.trim();
      normalizedCards = cleanedCards;
    }

    try {
      if (stageChanged) {
        const stageResponse = await fetch(`/api/decks/${encodeURIComponent(deckId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ learningStage }),
        });

        if (!stageResponse.ok) {
          throw new Error("Failed to save learning stage");
        }
      }

      if (contentChanged) {
        const response = await fetch(`/api/decks/${encodeURIComponent(deckId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: normalizedTitle,
            cards: normalizedCards,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save learning set");
        }
      }

      if (contentChanged) {
        setTitle(normalizedTitle);
        setCards(cloneCards(normalizedCards));
        setSavedFormSnapshot({
          title: normalizedTitle,
          cards: cloneCards(normalizedCards),
        });
      }
      if (stageChanged) {
        setSavedLearningStage(learningStage);
        setLearningStageDraft(learningStage);
        toast.success("Lernstufe geändert", "Die Lernstufe wurde erfolgreich übernommen.");
      }

      if (contentChanged) {
        setSuccess("Änderungen gespeichert.");
        toast.success("Änderungen gespeichert", "Deine Anpassungen wurden erfolgreich gespeichert.");
      }
      await refreshProgress(deckId);
      if (contentChanged) {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setError("Speichern fehlgeschlagen.");
      if (stageChanged) {
        toast.error("Lernstufe ändern fehlgeschlagen", "Die neue Lernstufe konnte nicht übernommen werden.");
      } else if (contentChanged) {
        toast.error("Speichern fehlgeschlagen", "Beim Speichern ist ein Fehler aufgetreten.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const applyLearningStage = async (stage: LearningStageOption, mode: "set" | "reset") => {
    if (!deckId) return;
    setIsApplyingLearningStage(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/decks/${encodeURIComponent(deckId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learningStage: stage }),
      });

      if (!response.ok) {
        throw new Error("Failed to update learning stage");
      }

      setLearningStage(stage);
      setSavedLearningStage(stage);
      setLearningStageDraft(stage);
      setIsLearningStageEditorOpen(false);
      if (mode === "set") {
        toast.success("Lernstufe geändert", "Die Lernstufe wurde erfolgreich übernommen.");
      } else {
        toast.success("Fortschritt zurückgesetzt", "Der Fortschritt wurde auf dieser Lernstufe zurückgesetzt.");
      }
      await refreshProgress(deckId);
    } catch (err) {
      console.error(err);
      if (mode === "set") {
        toast.error("Lernstufe ändern fehlgeschlagen", "Die neue Lernstufe konnte nicht übernommen werden.");
      } else {
        toast.error("Fortschritt zurücksetzen fehlgeschlagen", "Der Fortschritt konnte nicht zurückgesetzt werden.");
      }
    } finally {
      setIsApplyingLearningStage(false);
    }
  };

  const handleDeleteDeck = async () => {
    if (!deckId) return;

    setIsDeletingDeck(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/decks/${encodeURIComponent(deckId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete deck");
      }
      toast.success("Lernset gelöscht", "Das Lernset wurde erfolgreich entfernt.");
      router.push("/app/learn?deleted=1");
    } catch (err) {
      console.error(err);
      toast.error("Löschen fehlgeschlagen", "Das Lernset konnte nicht gelöscht werden.");
    } finally {
      setIsDeletingDeck(false);
    }
  };

  const handleOpenDeleteDeckModal = () => {
    if (isLoading || isDeletingDeck || isApplyingLearningStage || isSaving) return;
    setShowDeleteDeckModal(true);
  };

  const handleCancelDeleteDeck = () => {
    setShowDeleteDeckModal(false);
  };

  const handleConfirmDeleteDeck = async () => {
    setShowDeleteDeckModal(false);
    await handleDeleteDeck();
  };

  const handleResetProgress = async () => {
    if (isApplyingLearningStage || isLoading || isDeletingDeck || isSaving) return;
    setShowResetProgressModal(true);
  };

  const handleCancelResetProgress = () => {
    setShowResetProgressModal(false);
  };

  const handleConfirmResetProgress = async () => {
    setShowResetProgressModal(false);
    await applyLearningStage(learningStage, "reset");
  };

  const handleOpenLearningStageEditor = () => {
    setLearningStageDraft(learningStage);
    setIsLearningStageEditorOpen(true);
  };

  const handleCancelLearningStageEditor = () => {
    setLearningStageDraft(learningStage);
    setIsLearningStageEditorOpen(false);
  };

  const handleConfirmLearningStage = async () => {
    if (learningStageDraft === learningStage) {
      setIsLearningStageEditorOpen(false);
      return;
    }
    await applyLearningStage(learningStageDraft, "set");
  };

  const handleDiscardChanges = () => {
    if (savedFormSnapshot === null) return;
    if (deleteCardTimer.current !== null) {
      window.clearTimeout(deleteCardTimer.current);
      deleteCardTimer.current = null;
    }
    setDeletingCardIndex(null);
    setDeletingCardHeight(0);
    setOpenRefineMenuIndex(null);
    setTitle(savedFormSnapshot.title);
    setCards(cloneCards(savedFormSnapshot.cards));
    setLearningStage(savedLearningStage);
    setLearningStageDraft(savedLearningStage);
    setIsLearningStageEditorOpen(false);
    setError(null);
    setSuccess(null);
  };

  const requestRefinedCard = async (
    card: CardDraft,
    action: RefineAction
  ): Promise<{ card?: CardDraft; error?: string }> => {
    try {
      const response = await fetch("/api/ai/refine-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: card.question.trim(),
          answer: card.answer.trim(),
          action,
          title: title.trim(),
          style: "verstehen",
          difficulty: "mittel",
          topicFocus: "",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } | string }
          | null;
        const errorMessage =
          typeof payload?.error === "string"
            ? payload.error
            : payload?.error && typeof payload.error === "object" && typeof payload.error.message === "string"
              ? payload.error.message
              : "Die Verfeinerung ist fehlgeschlagen.";
        return { error: errorMessage };
      }

      const payload = (await response.json()) as { card?: CardDraft };
      if (!payload.card) {
        return { error: "Die Verfeinerung hat kein gültiges Ergebnis geliefert." };
      }

      return {
        card: {
          question: String(payload.card.question ?? "").trim(),
          answer: String(payload.card.answer ?? "").trim(),
        },
      };
    } catch {
      return { error: "Unerwarteter Fehler bei der Verfeinerung. Bitte erneut versuchen." };
    }
  };

  const handleRefineCard = async (index: number, action: RefineAction) => {
    const card = cards[index];
    if (!card) return;

    if (!card.question.trim() || !card.answer.trim()) {
      toast.info(
        "Inhalt fehlt",
        "Bitte zuerst Frage und Antwort ausfüllen, dann kann die Antwort verfeinert werden."
      );
      return;
    }

    if (!hasPremiumAccess) {
      setPremiumModalReason("refine");
      setShowPremiumModal(true);
      return;
    }

    setRefineLoading({ index, action });
    try {
      const result = await requestRefinedCard(card, action);
      if (result.error) {
        toast.error("Verfeinerung fehlgeschlagen", result.error);
        return;
      }

      if (!result.card) return;

      setCards((prev) =>
        prev.map((entry, idx) =>
          idx === index
            ? {
                ...entry,
                question: result.card?.question ?? "",
                answer: result.card?.answer ?? "",
              }
            : entry
        )
      );
      toast.success("Karte verbessert", "Die ausgewählte Karte wurde aktualisiert.");
    } finally {
      setRefineLoading(null);
    }
  };

  const hasUnsavedChanges = useMemo(() => {
    if (isLoading || savedFormSnapshot === null) return false;
    const titleChanged = title !== savedFormSnapshot.title;
    const cardsChanged = !areCardsEqual(cards, savedFormSnapshot.cards);
    const learningStageChanged = learningStage !== savedLearningStage;
    return titleChanged || cardsChanged || learningStageChanged;
  }, [isLoading, savedFormSnapshot, title, cards, learningStage, savedLearningStage]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!hasUnsavedChanges || allowNavigationRef.current) return;
      if (showLeaveConfirmModal) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr || hrefAttr.startsWith("#")) return;

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
  }, [hasUnsavedChanges, showLeaveConfirmModal]);

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
      if (deleteCardTimer.current !== null) {
        window.clearTimeout(deleteCardTimer.current);
      }
      if (saveBarExitTimer.current !== null) {
        window.clearTimeout(saveBarExitTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (hasUnsavedChanges) {
      if (saveBarExitTimer.current !== null) {
        window.clearTimeout(saveBarExitTimer.current);
        saveBarExitTimer.current = null;
      }
      if (!isSaveBarMounted) {
        setIsSaveBarMounted(true);
      }
      const rafId = window.requestAnimationFrame(() => {
        setIsSaveBarVisible(true);
      });
      return () => {
        window.cancelAnimationFrame(rafId);
      };
    }

    if (isSaveBarMounted) {
      setIsSaveBarVisible(false);
      if (saveBarExitTimer.current !== null) {
        window.clearTimeout(saveBarExitTimer.current);
      }
      saveBarExitTimer.current = window.setTimeout(() => {
        setIsSaveBarMounted(false);
        saveBarExitTimer.current = null;
      }, 150);
    }
    return;
  }, [hasUnsavedChanges, isSaveBarMounted]);

  const progressTotalCardsRaw = progressStats.known + progressStats.learning + progressStats.new;
  const safeProgressTotal = Math.max(1, progressTotalCardsRaw > 0 ? progressTotalCardsRaw : cards.length);
  const knownPct = Math.round((progressStats.known / safeProgressTotal) * 100);
  const learningPct = Math.round((progressStats.learning / safeProgressTotal) * 100);
  const newPct = Math.max(0, 100 - knownPct - learningPct);
  const showKnownLearningDivider = knownPct > 0 && learningPct > 0;
  const phaseMeta = getPhaseMeta(learningStage);

  return (
    <main className={isSaveBarMounted ? "pb-28" : "pb-12"}>
      <div className="relative flex flex-col gap-6">
        {showPremiumModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-lg">
              <h3 className="text-base font-semibold text-foreground">
                {premiumModalReason === "cardLimit"
                  ? "Mehr Fragen mit Premium"
                  : "Antworten verfeinern mit Premium"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {premiumModalReason === "cardLimit"
                  ? "Mit Premium kannst du mehr als 10 Fragen pro Lernset anlegen."
                  : "Mit Premium kannst du Fragen und Antworten direkt per KI verbessern."}
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
        {showResetProgressModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-lg">
              <h3 className="text-base font-semibold text-foreground">Fortschritt zurücksetzen?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Der Fortschritt dieser Lernstufe wird auf den Anfang zurückgesetzt.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button variant="outline" onClick={handleCancelResetProgress} className="w-full whitespace-normal">
                  Abbrechen
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void handleConfirmResetProgress()}
                  className="w-full whitespace-normal text-background hover:text-background"
                >
                  Fortschritt zurücksetzen
                </Button>
              </div>
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
        {showDeleteDeckModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-lg">
              <h3 className="text-base font-semibold text-foreground">Deck wirklich löschen?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Das Löschen kann nicht rückgängig gemacht werden.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button variant="outline" onClick={handleCancelDeleteDeck} className="w-full whitespace-normal">
                  Abbrechen
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void handleConfirmDeleteDeck()}
                  className="w-full whitespace-normal text-background hover:text-background"
                >
                  Deck löschen
                </Button>
              </div>
            </div>
          </div>
        )}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Lernset-Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <section className="space-y-3">
              <label className="text-[13px] text-muted-foreground opacity-70">
                Titel
              </label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm shadow-sm focus:border-foreground/20 focus:outline-none"
                placeholder="Lernset-Titel"
              />
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-1.5">
                <label className="text-[13px] text-muted-foreground opacity-70">
                  Lernstufe
                </label>
                <InfoTooltip
                  title="So funktionieren die Lernstufen"
                  description={`1) Einführung: Frage + Lösung sehen
2) Üben: Lösung in eigenen Worten erklären
3) Erklären: nur mit der Frage erklären`}
                  multilineDescription
                  positionClassName="!-left-2 !translate-x-0 min-w-[20rem]"
                  arrowClassName="!left-6 !right-auto"
                  className="-ml-1 mt-0.5 [&>span]:h-5 [&>span]:w-5"
                >
                  <svg
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    className="h-4 w-4 fill-none text-muted-foreground"
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
              {!isLearningStageEditorOpen ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex h-10 items-center rounded-[999px] px-4 text-sm ${phaseMeta.className}`}>
                      {phaseMeta.label}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-white/10 bg-muted/35 hover:bg-muted/55 dark:border-white/10 dark:bg-[color-mix(in_srgb,var(--muted)_58%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--muted)_72%,transparent)] sm:w-auto"
                      onClick={handleOpenLearningStageEditor}
                      disabled={isLoading || isApplyingLearningStage || isDeletingDeck || isSaving}
                    >
                      Lernstufe ändern
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <fieldset
                    role="radiogroup"
                    aria-label="Lernstufe auswählen"
                    className="space-y-2"
                    disabled={isLoading || isApplyingLearningStage || isDeletingDeck || isSaving}
                  >
                    {LEARNING_STAGE_OPTIONS.map((option) => {
                      const isSelected = learningStageDraft === option.value;
                      return (
                        <label
                          key={option.value}
                          className={`block cursor-pointer rounded-xl border px-3 py-2 transition ${
                            isSelected
                              ? "border-primary/70 bg-primary/10"
                              : "border-border bg-background hover:border-foreground/20"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="radio"
                              name="learning-stage-edit"
                              value={option.value}
                              checked={isSelected}
                              onChange={() => setLearningStageDraft(option.value)}
                              className="mt-0.5 h-4 w-4 accent-primary"
                              disabled={isLoading || isApplyingLearningStage || isDeletingDeck || isSaving}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{option.label}</p>
                              <p className="text-xs text-muted-foreground">{option.hint}</p>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </fieldset>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/10 bg-muted/35 hover:bg-muted/55 dark:border-white/10 dark:bg-[color-mix(in_srgb,var(--muted)_58%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--muted)_72%,transparent)]"
                      onClick={handleCancelLearningStageEditor}
                      disabled={isApplyingLearningStage}
                    >
                      Abbrechen
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void handleConfirmLearningStage()}
                      isLoading={isApplyingLearningStage}
                      loadingText="Übernehme"
                      disabled={isLoading || isApplyingLearningStage || isDeletingDeck || isSaving}
                    >
                      Lernstufe speichern
                    </Button>
                  </div>
                </div>
              )}
              <p className="text-[13px] text-muted-foreground opacity-70">
                Beim Ändern der Lernstufe wird der Fortschritt der Karten zurückgesetzt.
              </p>
            </section>

            <section className="space-y-3">
              <label className="text-[13px] text-muted-foreground opacity-70">
                Fortschritt
              </label>
              <div className="flex items-center gap-3">
                <div className="flex h-3 flex-1 overflow-hidden rounded-full border border-secondary">
                  <div
                    className="bg-success"
                    style={{
                      width: `${knownPct}%`,
                      borderRightWidth: showKnownLearningDivider ? "1px" : "0",
                      borderRightStyle: "solid",
                      borderRightColor: "var(--background)",
                    }}
                  />
                  <div className="bg-warning" style={{ width: `${learningPct}%` }} />
                  <div className="bg-muted-foreground/30" style={{ width: `${newPct}%` }} />
                </div>
                <div className="shrink-0 text-sm text-muted-foreground">
                  (
                  <span className="mx-1 inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    {progressStats.known}
                  </span>
                  <span className="mx-1 inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-warning" />
                    {progressStats.learning}
                  </span>
                  <span className="mx-1 inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                    {progressStats.new}
                  </span>
                  )
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-white/10 bg-muted/35 hover:bg-muted/55 dark:border-white/10 dark:bg-[color-mix(in_srgb,var(--muted)_58%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--muted)_72%,transparent)] sm:w-auto"
                onClick={() => void handleResetProgress()}
                isLoading={isApplyingLearningStage}
                loadingText="Setze zurück"
                disabled={isLoading || isApplyingLearningStage || isDeletingDeck || isSaving}
              >
                Fortschritt zurücksetzen
              </Button>
            </section>

          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 rounded-3xl bg-card p-10 shadow-sm">
            <ArrowPathIcon className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Einen Moment, wir laden gerade dein Lernset...</p>
          </div>
        ) : (
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Fragen bearbeiten
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-start justify-between gap-3">
                <p className="text-sm text-muted-foreground">{cards.length} Karten</p>
              </div>
              {cards.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Dieses Lernset hat noch keine Karten. Ergänze neue Fragen.
                </p>
              )}
              <div className="flex flex-col">
                {cards.map((card, index) => (
                  <div
                    key={card.id ?? index}
                    ref={(element) => {
                      cardElementRefs.current[index] = element;
                    }}
                    data-create-card="true"
                    className={`mb-8 space-y-5 rounded-2xl border border-border bg-card/95 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_6px_16px_rgba(0,0,0,0.14)] transition-all duration-300 last:mb-0 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.16)] md:p-5 dark:bg-[color-mix(in_srgb,var(--card)_90%,var(--muted)_10%)] ${
                      deletingCardIndex === index ? "isDeleting pointer-events-none" : ""
                    }`}
                    style={
                      deletingCardIndex === index
                        ? { ["--delete-start-height" as string]: `${Math.max(deletingCardHeight, 1)}px` }
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-xs font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {refineLoading?.index === index ||
                        !card.question.trim() ||
                        !card.answer.trim() ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 border-white/10 bg-muted/40 text-xs text-foreground hover:bg-muted/55 dark:border-white/10 dark:bg-[color-mix(in_srgb,var(--muted)_65%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--muted)_78%,transparent)]"
                            disabled
                          >
                            <SparklesIcon className="h-4 w-4" />
                            {refineLoading?.index === index ? "Verbessere…" : "Verbessern"}
                            <img
                              src="/icons/premium-crown.svg"
                              alt="Premium"
                              width={14}
                              height={14}
                              className="h-3.5 w-3.5"
                            />
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
                              <img
                                src="/icons/premium-crown.svg"
                                alt="Premium"
                                width={14}
                                height={14}
                                className="h-3.5 w-3.5"
                              />
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
                                    disabled={refineLoading?.index === index}
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
                          disabled={deletingCardIndex !== null}
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
                          value={card.answer}
                          onChange={(event) => handleUpdateCard(index, "answer", event.target.value)}
                          rows={3}
                          className="min-h-[96px] resize-y rounded-xl border-white/10 !bg-transparent text-xs transition-colors focus:border-primary sm:text-sm"
                          placeholder="Antwort eingeben"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 bg-muted/35 hover:bg-muted/55 dark:border-white/10 dark:bg-[color-mix(in_srgb,var(--muted)_58%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--muted)_72%,transparent)]"
                  onClick={handleAddCard}
                  disabled={isLoading || deletingCardIndex !== null}
                >
                  Karte hinzufügen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && (
          <section className="space-y-3 border-t border-border pt-5">
            <h3 className="text-sm font-semibold text-foreground">Danger Zone</h3>
            <Button
              variant="destructive"
              size="sm"
              className="w-full text-background sm:w-auto"
              onClick={handleOpenDeleteDeckModal}
              isLoading={isDeletingDeck}
              loadingText="Lösche Lernset"
              disabled={isLoading || isDeletingDeck || isApplyingLearningStage || isSaving}
            >
              Deck löschen
            </Button>
            <p className="text-[13px] text-muted-foreground opacity-70">
              Das Löschen entfernt das Lernset dauerhaft.
            </p>
          </section>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {isSaveBarMounted && (
          <div
            className={`fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-card)] shadow-[0_-6px_20px_rgba(0,0,0,0.15)] transition-all ${
              isSaveBarVisible
                ? "translate-y-0 opacity-100 duration-200 ease-out"
                : "translate-y-full opacity-0 duration-150 ease-in"
            }`}
          >
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Ungespeicherte Änderungen</p>
                <p className="text-xs text-muted-foreground">Du hast ungespeicherte Änderungen.</p>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:items-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-white/10 bg-muted/35 hover:bg-muted/55 dark:border-white/10 dark:bg-[color-mix(in_srgb,var(--muted)_58%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--muted)_72%,transparent)] sm:w-auto"
                  onClick={handleDiscardChanges}
                  disabled={isSaving || isApplyingLearningStage || isDeletingDeck}
                >
                  Verwerfen
                </Button>
                <LoadingButton
                  onClick={handleSave}
                  className="w-full sm:w-auto"
                  disabled={isSaving || isLoading || isApplyingLearningStage || isDeletingDeck}
                  isLoading={isSaving}
                  loadingText="Speichere"
                  text="Änderungen speichern"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
