import type { Metadata } from "next";
import { db } from "@/lib/db";
import EditDeckPageClient from "./edit-deck-page-client";

const BRAND_SUFFIX = " – Talk to Learn";
const FALLBACK_TITLE = `Lernset bearbeiten${BRAND_SUFFIX}`;
const MAX_DECK_TITLE_LENGTH = 36;

function decodeParam(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function formatDeckTitle(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= MAX_DECK_TITLE_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_DECK_TITLE_LENGTH - 1)}…`;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const deckId = decodeParam(params.id);
  if (!deckId) {
    return { title: FALLBACK_TITLE };
  }

  try {
    const deck = await db.deck.findUnique({
      where: { id: deckId },
      select: { title: true },
    });
    const deckTitle = formatDeckTitle(deck?.title);

    return {
      title: deckTitle ? `Bearbeiten: ${deckTitle}${BRAND_SUFFIX}` : FALLBACK_TITLE,
    };
  } catch {
    return { title: FALLBACK_TITLE };
  }
}

export default function EditDeckPage(): JSX.Element {
  return <EditDeckPageClient />;
}
