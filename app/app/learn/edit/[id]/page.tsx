"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { UserIcon } from "@heroicons/react/24/outline";
import { UserIcon as UserIconSolid } from "@heroicons/react/24/solid";
import { IconSwap } from "@/components/ui/icon";

const EMPTY_CARD = { question: "", answer: "" };

type CardDraft = {
  id?: string;
  question: string;
  answer: string;
};

type DeckPayload = {
  id: string;
  title: string;
  cards: CardDraft[];
};

export default function EditDeckPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [title, setTitle] = useState("");
  const [cards, setCards] = useState<CardDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const deckId = useMemo(() => {
    const raw = params?.id;
    return typeof raw === "string" ? decodeURIComponent(raw) : "";
  }, [params?.id]);

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
      } catch (err) {
        console.error(err);
        setError("Lernset konnte nicht geladen werden.");
      } finally {
        setIsLoading(false);
      }
    };

    loadDeck();
  }, [deckId]);

  const handleUpdateCard = (index: number, field: "question" | "answer", value: string) => {
    setCards((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddCard = () => {
    setCards((prev) => [...prev, { ...EMPTY_CARD }]);
  };

  const handleRemoveCard = (index: number) => {
    setCards((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    if (!deckId) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);

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

    try {
      const response = await fetch(`/api/decks/${encodeURIComponent(deckId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          cards: cleanedCards,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save learning set");
      }

      setSuccess("Änderungen gespeichert.");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Speichern fehlgeschlagen.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetProgress = async () => {
    if (!deckId) return;
    setIsResetting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId, action: "reset" }),
      });

      if (!response.ok) {
        throw new Error("Failed to reset progress");
      }

      setSuccess("Fortschritt zurückgesetzt.");
    } catch (err) {
      console.error(err);
      setError("Fortschritt konnte nicht zurückgesetzt werden.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <main className="pb-12">
      <div className="relative flex flex-col gap-6">
        <header className="flex items-start justify-between gap-4 rounded-3xl border border-border bg-card px-6 py-5 shadow-sm">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Lernset bearbeiten
            </p>
            <h1 className="text-3xl font-bold text-foreground">
              Lernset anpassen
            </h1>
            <p className="text-sm text-muted-foreground">
              Überarbeite Fragen, ergänze neue Karten oder setze den Fortschritt zurück.
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
              Lernset-Details
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
                placeholder="Lernset-Titel"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <LoadingButton
                onClick={handleSave}
                disabled={isSaving || isLoading}
                isLoading={isSaving}
                loadingText="Speichere"
                text="Änderungen speichern"
              />
              <Button
                variant="destructive"
                onClick={handleResetProgress}
                isLoading={isResetting}
                loadingText="Zurücksetzen"
                disabled={isLoading}
              >
                Fortschritt zurücksetzen
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center rounded-3xl border border-border bg-card p-10 shadow-sm">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-foreground" />
          </div>
        ) : (
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Fragen bearbeiten
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cards.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Dieses Lernset hat noch keine Karten. Ergänze neue Fragen.
                </p>
              )}
              {cards.map((card, index) => (
                <div key={card.id ?? index} className="rounded-2xl border border-border bg-background p-4 shadow-sm">
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
                <Button variant="outline" onClick={handleAddCard} disabled={isLoading}>
                  Karte hinzufügen
                </Button>
              </div>
            </CardContent>
          </Card>
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
      </div>
    </main>
  );
}
