"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { UserIcon } from "@heroicons/react/24/outline";
import { UserIcon as UserIconSolid } from "@heroicons/react/24/solid";
import { IconSwap } from "@/components/ui/icon";
import { clearHeroUpload, loadHeroUpload } from "@/lib/hero-upload-store";

type CardDraft = {
  question: string;
  answer: string;
};

type DraftPayload = {
  title: string;
  cards: CardDraft[];
};

const DRAFT_STORAGE_KEY = "ttl:create-deck-draft";
const MAX_UPLOAD_MB = 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export default function CreateDeckPage(): JSX.Element {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const autoSaveTriggered = useRef(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [cards, setCards] = useState<CardDraft[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topicFocus, setTopicFocus] = useState("");
  const [style, setStyle] = useState("kompakt");
  const [difficulty, setDifficulty] = useState("mittel");
  const [count, setCount] = useState(8);
  const [progress, setProgress] = useState(0);

  const usingFile = !!file;

  const saveDraft = (payload: DraftPayload) => {
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors (private mode / quota)
    }
  };

  const loadDraft = (): DraftPayload | null => {
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DraftPayload;
      if (!parsed?.title || !Array.isArray(parsed.cards)) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const clearDraft = () => {
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (!user || autoSaveTriggered.current) return;
    const draft = loadDraft();
    if (!draft) return;

    autoSaveTriggered.current = true;
    if (!title && cards.length === 0) {
      setTitle(draft.title);
      setCards(draft.cards);
    }

    const autoSave = async () => {
      setIsSaving(true);
      setError(null);
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
          throw new Error("Auto-save failed");
        }

        clearDraft();
        router.replace("/app/learn");
      } catch (err) {
        setError("Speichern fehlgeschlagen.");
      } finally {
        setIsSaving(false);
      }
    };

    autoSave();
  }, [user, router, title, cards.length]);

  useEffect(() => {
    if (file) return;
    let isActive = true;
    const fetchUpload = async () => {
      const uploaded = await loadHeroUpload();
      if (!uploaded || !isActive) return;
      if (uploaded.size > MAX_UPLOAD_BYTES) {
        setError(`Datei zu groß. Maximal ${MAX_UPLOAD_MB} MB erlaubt.`);
        await clearHeroUpload();
        return;
      }
      setFile(uploaded);
      setFileName(uploaded.name);
      await clearHeroUpload();
    };
    void fetchUpload();
    return () => {
      isActive = false;
    };
  }, [file]);

  const canGenerate = useMemo(() => {
    return title.trim().length > 0 && usingFile;
  }, [title, usingFile]);

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      setProgress(10);
      const response = await fetch("/api/ai/generate-file", {
        method: "POST",
        body: (() => {
          const formData = new FormData();
          formData.append("title", title.trim());
          formData.append("topicFocus", topicFocus.trim());
          formData.append("style", style);
          formData.append("difficulty", difficulty);
          formData.append("count", String(count));
          if (file) formData.append("file", file);
          return formData;
        })(),
      });

      if (!response.ok) {
        throw new Error("Generierung fehlgeschlagen.");
      }

      const data = await response.json();
      setProgress(80);
      setCards(data.cards ?? []);
      setProgress(100);
    } catch (err) {
      setError("AI-Generierung fehlgeschlagen.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateCard = (index: number, key: keyof CardDraft, value: string) => {
    setCards((prev) =>
      prev.map((card, idx) => (idx === index ? { ...card, [key]: value } : card))
    );
  };

  const handleAddCard = () => {
    setCards((prev) => [...prev, { question: "", answer: "" }]);
  };

  const handleRemoveCard = (index: number) => {
    setCards((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      const cleaned = cards
        .map((card) => ({
          question: card.question.trim(),
          answer: card.answer.trim(),
        }))
        .filter((card) => card.question && card.answer);

      if (cleaned.length === 0) {
        setError("Bitte mindestens eine Frage mit Antwort anlegen.");
        setIsSaving(false);
        return;
      }

      if (!user) {
        saveDraft({ title: title.trim(), cards: cleaned });
        router.push("/auth/sign-in?callbackUrl=/app/create");
        return;
      }

      const response = await fetch("/api/ai/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          cards: cleaned,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          saveDraft({ title: title.trim(), cards: cleaned });
          router.push("/auth/sign-in?callbackUrl=/app/create");
          return;
        }
        throw new Error("Speichern fehlgeschlagen.");
      }

      clearDraft();
      router.push("/app/learn");
    } catch (err) {
      setError("Speichern fehlgeschlagen.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-background px-6 py-8">

      {isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
          <div className="relative rounded-3xl border border-border bg-card px-10 py-8 text-center text-foreground shadow-sm">
            <div className="mx-auto mb-5 h-16 w-16 rounded-full border-4 border-border border-t-foreground animate-spin" />
            <p className="text-base font-semibold">Fragen werden generiert</p>
            <p className="text-sm text-muted-foreground">KI baut dein Lernset in Sekunden.</p>
            <div className="mt-4 h-2 w-64 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="relative mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex items-start justify-between gap-4 rounded-3xl border border-border bg-card px-6 py-5 shadow-sm">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              AI-Inhaltserstellung
            </p>
            <h1 className="text-3xl font-bold text-foreground">
              Neues Lernset erzeugen
            </h1>
            <p className="text-sm text-muted-foreground">
              Lade Skripte hoch, wir erzeugen passende Fragen aus dem Inhalt.
            </p>
          </div>
          <Link
            href="/app/account"
            className="group flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background shadow-sm transition hover:border-foreground/20"
            aria-label="Account"
          >
            {user?.image && !avatarFailed ? (
              <Image
                src={user.image}
                alt="Account"
                width={32}
                height={32}
                sizes="32px"
                className="h-8 w-8 rounded-full object-cover"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {user?.name?.charAt(0) ?? (
                  <IconSwap
                    outline={UserIcon}
                    solid={UserIconSolid}
                    className="h-4 w-4"
                  />
                )}
              </span>
            )}
          </Link>
        </header>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Quelle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">
                Titel
              </label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm shadow-sm focus:border-foreground/20 focus:outline-none"
                placeholder="z. B. Mikroökonomie Klausur"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">
                Datei (PDF, TXT, MD)
              </label>
              <label className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background px-4 py-6 text-center shadow-sm transition hover:border-foreground/20">
                <div className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm">
                  Datei auswählen
                </div>
                <p className="text-sm text-muted-foreground">
                  Ziehe eine Datei hierher oder tippe zum Auswählen
                </p>
                <p className="text-sm text-muted-foreground">
                  PDF, TXT oder MD – max. 1 Datei (bis {MAX_UPLOAD_MB} MB)
                </p>
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  disabled={!!file}
                  onChange={(event) => {
                    const selected = event.target.files?.[0] ?? null;
                    if (selected && selected.size > MAX_UPLOAD_BYTES) {
                      setError(`Datei zu groß. Maximal ${MAX_UPLOAD_MB} MB erlaubt.`);
                      event.target.value = "";
                      return;
                    }
                    setError(null);
                    setFile(selected);
                    setFileName(selected?.name ?? "");
                  }}
                  className="hidden"
                />
              </label>
            </div>
            {usingFile && (
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">
                  Datei: <span className="font-semibold">{fileName}</span>
                </p>
                <Button
                  variant="outline"
                  className="w-full md:w-auto"
                  onClick={() => {
                    setFile(null);
                    setFileName("");
                  }}
                >
                  Datei entfernen
                </Button>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">
                Themen-Fokus
              </label>
              <p className="text-sm text-muted-foreground">
                Nenne die wichtigsten Kapitel oder Schwerpunkte. So priorisiert die KI
                genau die Inhalte, die du für die Prüfung brauchst.
              </p>
              <Textarea
                value={topicFocus}
                onChange={(event) => setTopicFocus(event.target.value)}
                rows={3}
                className="resize-none rounded-xl border border-border bg-background shadow-sm focus:border-foreground/20"
                placeholder="z. B. Definitionen, typische Prüfungsfragen, Rechenwege"
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground">
                  Fragestil
                </label>
                <select
                  value={style}
                  onChange={(event) => setStyle(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-foreground/20"
                >
                  <option value="kompakt">Kompakt</option>
                  <option value="pruefung">Prüfungsnah</option>
                  <option value="erklaerend">Erklärend</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground">
                  Schwierigkeit: {difficulty}
                </label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  value={difficulty === "leicht" ? 1 : difficulty === "mittel" ? 2 : 3}
                  onChange={(event) => {
                    const val = Number(event.target.value);
                    setDifficulty(val === 1 ? "leicht" : val === 2 ? "mittel" : "schwer");
                  }}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Leicht</span>
                  <span>Mittel</span>
                  <span>Schwer</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground">
                  Anzahl Fragen: {count}
                </label>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value))}
                  className="w-full"
                />
                <div className="text-sm text-muted-foreground">Maximal 10 in der Free-Version.</div>
              </div>
            </div>
            <LoadingButton
              className="w-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 md:w-auto"
              disabled={!canGenerate || isGenerating}
              onClick={handleGenerate}
              isLoading={isGenerating}
              loadingText="Generiere"
              text="Fragen generieren"
            />
          </CardContent>
        </Card>

        {cards.length > 0 && (
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Review & Edit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">KI-Power</span>{" "}
                – präzise Fragen aus deinem Material, sofort startklar.
              </div>
              {cards.map((card, index) => (
                <div key={index} className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-muted-foreground">
                      Frage {index + 1}
                    </label>
                    <Textarea
                      value={card.question}
                      onChange={(event) =>
                        handleUpdateCard(index, "question", event.target.value)
                      }
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div className="mt-3 space-y-2">
                    <label className="text-sm font-semibold text-muted-foreground">
                      Antwort
                    </label>
                    <Textarea
                      value={card.answer}
                      onChange={(event) =>
                        handleUpdateCard(index, "answer", event.target.value)
                      }
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() => handleRemoveCard(index)}
                    >
                      Entfernen
                    </Button>
                  </div>
                </div>
              ))}
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
                  Zum Speichern brauchst du einen kostenlosen Account.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </main>
  );
}
