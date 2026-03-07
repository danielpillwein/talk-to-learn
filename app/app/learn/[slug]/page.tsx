import type { Metadata } from "next";
import { db } from "@/lib/db";
import LearnDetailPageClient from "./learn-detail-page-client";

const BRAND_SUFFIX = " – Talk to Learn";
const FALLBACK_TITLE = `Lernsession${BRAND_SUFFIX}`;
const MAX_DECK_TITLE_LENGTH = 44;

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
  params: { slug: string };
}): Promise<Metadata> {
  const deckId = decodeParam(params.slug);
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
      title: deckTitle ? `${deckTitle}${BRAND_SUFFIX}` : FALLBACK_TITLE,
    };
  } catch {
    return { title: FALLBACK_TITLE };
  }
}

export default function LearnDetailPage(): JSX.Element {
  return <LearnDetailPageClient />;
}
