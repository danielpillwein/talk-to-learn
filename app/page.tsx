import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { HeroUploadCta } from "@/components/hero-upload-cta";
import { HeroTypewriter } from "@/components/hero-typewriter";
import { HeroReviewCarousel } from "@/components/hero-review-carousel";
import { FeaturesBento } from "@/components/landing/FeaturesBento";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { HashScrollHandler } from "@/components/landing/hash-scroll-handler";
import { LandingPricing } from "@/components/landing-pricing";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { SiteFooter } from "@/components/site-footer";
import { billing, getPricingCards } from "@/src/config/billing";

export const metadata: Metadata = {
  title: "Talk to Learn – Mit KI durch Erklären lernen",
  description:
    "Talk to Learn hilft Studierenden, Lernstoff laut zu trainieren. Kurze Sessions, AI-Feedback, spaced repetition – ideal für Klausurvorbereitung.",
  openGraph: {
    title: "Talk to Learn",
    description:
      "Sprechbasierte Lernsessions für Studierende: laut antworten, sofortiges Feedback, smarter Lernrhythmus.",
    url: "https://talk-to-learn.local/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Talk to Learn",
    description:
      "Sprechbasierte Lernsessions für Studierende: laut antworten, sofortiges Feedback, smarter Lernrhythmus.",
  },
};

export default function LandingPage(): JSX.Element {
  const pricingCards = getPricingCards();
  const trustBadges = [
    "Für Studierende",
    "KI-gestützt",
    "Personalisiert",
    "Feedback in Sekunden",
    "Erklären statt nur Wiederholen",
  ];

  return (
    <main className="bg-background text-foreground">
      <HashScrollHandler />
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
          <Link href="/" className="flex min-w-0 items-center gap-3 font-semibold">
            <Image
              src="/mascot/favicon.png"
              alt="Talk-to-Learn Maskottchen"
              width={425}
              height={425}
              sizes="40px"
              className="h-10 w-10 rounded-full object-cover"
              priority
            />
            <span className="max-w-[140px] truncate text-base sm:max-w-none">
              Talk-to-Learn
            </span>
          </Link>
          <div className="hidden flex-1 items-center justify-center gap-6 text-sm md:flex">
            <a href="#features" className="text-muted-foreground hover:text-foreground">
              Features
            </a>
            <a href="#preise" className="text-muted-foreground hover:text-foreground">
              Preise
            </a>
            <Link href="/auth/sign-in" className="text-muted-foreground hover:text-foreground">
              Mit Google anmelden
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/auth/sign-in"
              className="hidden rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:inline-flex"
            >
              Kostenlos starten
            </Link>
            <Link
              href="/auth/sign-in"
              className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden"
            >
              Starten
            </Link>
          </div>
        </div>
      </nav>

      <div className="overflow-x-hidden pt-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-12 md:gap-24 md:py-20">
        <header className="grid gap-6 pb-4 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] md:items-start md:gap-8 md:pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="order-1 space-y-6 text-center md:order-none md:col-start-1 md:row-start-1 md:pr-6 md:text-left lg:pr-2 lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground shadow-sm">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Upload → Fragen → Erklären
            </div>
            <h1
              className="text-[28px] font-semibold leading-[1.12] break-words hyphens-auto sm:text-4xl sm:leading-tight md:break-normal md:hyphens-none md:text-5xl lg:text-6xl"
              lang="de"
            >
              Erstelle{" "}
              <span className="text-primary italic">Karteikarten</span> mit KI aus{" "}
              <span className="mx-auto block max-w-[20ch] break-words hyphens-auto sm:mx-0 sm:max-w-[22ch] md:inline-flex md:max-w-none md:whitespace-nowrap">
                <HeroTypewriter className="block max-w-full text-primary italic md:inline-flex md:items-baseline md:h-[1.2em] md:leading-[1.2em] md:min-w-[22ch] md:whitespace-nowrap" />
              </span>
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
              Du lieferst die Inhalte. Wir stellen dir die wichtigen Fragen.{" "}
              <span className="font-semibold text-foreground/80">
                Denn wer erklären kann, hats wirklich verstanden.
              </span>
            </p>
            <div className="-mt-1 flex flex-wrap justify-center gap-2 text-[10px] text-muted-foreground sm:text-xs md:justify-start">
              {trustBadges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-border/70 bg-accent/40 px-2.5 py-1 text-accent-foreground sm:px-3"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>

          <div className="order-3 h-[220px] sm:h-auto md:order-none md:col-start-2 md:row-start-1 md:h-[360px] lg:h-full">
            <div className="h-full w-full overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <Image
                src="/mascot/otter-hero-section.png"
                alt="Otter-Illustration für den Hero-Bereich"
                width={2528}
                height={1696}
                sizes="(max-width: 767px) calc(100vw - 3rem), 360px"
                quality={95}
                className="h-full w-full object-cover"
                priority
              />
            </div>
          </div>

          <div className="order-2 pb-6 md:order-none md:col-span-2 md:row-start-2 md:pb-0">
            <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
              <div className="flex h-full flex-col gap-3">
                <div className="mx-auto w-full max-w-[360px] md:mx-0 md:max-w-none">
                  <HeroUploadCta />
                </div>
              </div>
              <div className="h-full w-full max-w-sm md:max-w-none">
                <HeroReviewCarousel />
              </div>
            </div>
          </div>
        </header>

        <FeaturesBento className="-mt-6 md:-mt-8" />

        <HowItWorks />

        <section id="preise" className="space-y-8">
          <div className="flex items-end justify-between gap-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Preise
              </p>
              <h2 className="text-3xl font-semibold">Fair, klar, studierendengerecht.</h2>
            </div>
          </div>
          <LandingPricing
            cards={pricingCards}
            yearlyDiscountBadge={billing.text.pricing.yearlyDiscountBadge}
            yearlySavingsLabel={billing.text.pricing.yearlySavingsLabel}
          />
        </section>

        <section className="space-y-8">
          <FaqAccordion />
        </section>

        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <h2 className="text-3xl font-semibold">
                Bereit für deine nächste Prüfung?
              </h2>
              <p className="text-sm text-muted-foreground">
                Starte kostenlos und verwandle deine Unterlagen in klare Lernsessions.
              </p>
            </div>
            <Link
              href="/auth/sign-in"
              className="rounded-full bg-primary px-6 py-3 text-center text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              Kostenlos starten
            </Link>
          </div>
        </section>

        <SiteFooter />
        </div>
      </div>
    </main>
  );
}
