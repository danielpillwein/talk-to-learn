import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ThemeSwitchClient } from "@/components/theme-switch";
import { HeroUploadCta } from "@/components/hero-upload-cta";
import { HeroTypewriter } from "@/components/hero-typewriter";
import { HeroReviewCarousel } from "@/components/hero-review-carousel";

export const metadata: Metadata = {
  title: "Talk to Learn | Sprechbasierte Lernsessions für Studierende",
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
  const trustBadges = [
    "Für Studierende",
    "KI-gestützt",
    "Personalisiert",
    "Feedback in Sekunden",
    "Erklären statt nur Wiederholen",
  ];

  const bentoFeatures = [
    {
      title: "Upload deiner Unterlagen",
      text: "PDFs, Skripte oder Notizen rein – in Minuten startklar.",
      span: "lg:col-span-5 lg:row-span-2",
      tone: "bg-primary/10 border-primary/30",
    },
    {
      title: "Automatische Fragen",
      text: "Die KI baut Fragen, die auf Prüfungen einzahlen.",
      span: "lg:col-span-4",
      tone: "bg-accent/40 border-border",
    },
    {
      title: "Audio-Erklärung",
      text: "Du erklärst laut – so trainierst du echtes Verstehen.",
      span: "lg:col-span-3",
      tone: "bg-success/10 border-success/40",
    },
    {
      title: "KI-Feedback & Rubrik",
      text: "Klare Hinweise, was fehlt und wie du dich verbesserst.",
      span: "lg:col-span-4",
      tone: "bg-secondary/25 border-secondary/40",
    },
    {
      title: "Musterantwort",
      text: "Vergleiche deine Antwort mit der idealen Lösung.",
      span: "lg:col-span-3",
      tone: "bg-warning/10 border-warning/40",
    },
    {
      title: "Deck-Management",
      text: "Organisiere Fächer, Themen und Prüfungen übersichtlich.",
      span: "lg:col-span-5",
      tone: "bg-muted/60 border-border",
    },
    {
      title: "Fortschritt & Streaks",
      text: "Sieh, was sitzt – und was du als Nächstes üben solltest.",
      span: "lg:col-span-4",
      tone: "bg-danger/10 border-danger/40",
    },
    {
      title: "Export / Wiederholen",
      text: "Nimm deine Sets mit oder wiederhole smart.",
      span: "lg:col-span-3",
      tone: "bg-card border-border",
    },
  ];

  const steps = [
    {
      title: "Unterlagen hochladen",
      text: "Zieh PDFs oder Skripte hinein – Talk-to-Learn liest mit.",
    },
    {
      title: "Frage beantworten – du erklärst per Audio",
      text: "Laut erklären trainiert echtes Verständnis.",
    },
    {
      title: "Feedback + Musterantwort – sofort",
      text: "In Sekunden weißt du, was sitzt und was fehlt.",
    },
  ];

  const testimonials = [
    {
      name: "Lea M.",
      study: "Psychologie, 3. Semester",
      text: "Ich merke sofort, wo meine Erklärung wackelt. Das spart Stunden.",
    },
    {
      name: "Jannis K.",
      study: "BWL, Master",
      text: "Audio erklären fühlt sich wie die Prüfung an – extrem hilfreich.",
    },
    {
      name: "Sofia R.",
      study: "Medizin, 1. Staatsexamen",
      text: "Feedback + Musterantwort ist genau der Schritt, der mir fehlte.",
    },
  ];

  const stats = [
    { label: "Fragen geübt", value: "28.400+" },
    { label: "Minuten gesprochen", value: "9.600+" },
    { label: "Decks erstellt", value: "1.120+" },
  ];

  const faqs = [
    {
      question: "Welche Formate kann ich hochladen?",
      answer:
        "PDF, Text oder Markdown. Wichtig ist, dass die Inhalte strukturiert sind.",
    },
    {
      question: "Wie entsteht das Feedback?",
      answer:
        "Die KI bewertet deine Antwort, zeigt Lücken und liefert eine Musterantwort.",
    },
    {
      question: "Brauche ich besondere Technik für Audio?",
      answer:
        "Ein normales Laptop- oder Handy-Mikro reicht völlig aus.",
    },
    {
      question: "Ist das für Gruppenarbeit geeignet?",
      answer:
        "Im Moment ist es auf Einzel-Lernsessions optimiert.",
    },
    {
      question: "Kann ich die Decks exportieren?",
      answer:
        "Ja, Export und Wiederholungen sind Teil des Pro-Plans.",
    },
  ];

  return (
    <main className="bg-background text-foreground">
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
            <a href="#produkt" className="text-muted-foreground hover:text-foreground">
              Produkt
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
            <button
              type="button"
              className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground md:hidden"
              aria-label="Menü öffnen"
            >
              Menü
            </button>
            <ThemeSwitchClient />
          </div>
        </div>
      </nav>

      <div className="overflow-x-hidden pt-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-12 md:gap-24 md:py-20">
        <header className="grid gap-6 pb-10 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] md:items-start md:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
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
                width={800}
                height={600}
                sizes="(max-width: 1024px) 100vw, 30vw"
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

        <section id="produkt" className="space-y-8">
          <div className="flex items-end justify-between gap-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Produkt
              </p>
              <h2 className="text-3xl font-semibold">Bento-Features für Fokus.</h2>
              <p className="text-sm text-muted-foreground">
                Klare Bausteine, die dich Schritt für Schritt durch den Lernflow
                führen.
              </p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-12">
            {bentoFeatures.map((feature) => (
              <article
                key={feature.title}
                className={`group relative overflow-hidden rounded-3xl border p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md ${feature.span} ${feature.tone} ${
                  feature.title === "Upload deiner Unterlagen" ? "pb-32" : ""
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background/60 text-sm font-semibold text-foreground transition duration-300 group-hover:scale-105">
                  ✦
                </div>
                <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.text}</p>
                <div className="mt-4 h-1 w-10 rounded-full bg-primary/40 transition duration-300 group-hover:w-16 group-hover:bg-primary/70" />
                {feature.title === "Upload deiner Unterlagen" && (
                  <Image
                    src="/mascot/otter-curious.png"
                    alt="Neugieriges Otter-Maskottchen"
                    width={874}
                    height={893}
                    sizes="(max-width: 768px) 112px, 128px"
                    className="pointer-events-none absolute bottom-0 right-4 h-28 w-auto object-contain transition duration-300 group-hover:scale-105 md:h-32"
                  />
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
            <Image
              src="/mascot/otter-learning.png"
              alt="Otter beim Lernen"
              width={714}
              height={536}
              sizes="(max-width: 768px) 96px, 112px"
              className="order-2 h-24 w-auto object-contain -scale-x-100 md:order-none md:h-28 md:scale-x-100"
            />
            <div className="order-1 space-y-3 md:order-none">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                So funktioniert&apos;s
              </p>
              <h2 className="text-3xl font-semibold">In 3 Schritten bereit.</h2>
            </div>
          </div>
          <div className="relative grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-1 hover:border-foreground/20"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
                <div className="mt-4 h-20 rounded-2xl border border-dashed border-border bg-secondary/20" />
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <div className="flex items-end justify-between gap-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Stimmen aus dem Studium
              </p>
              <h2 className="text-3xl font-semibold">Sympathisch, weil es hilft.</h2>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {testimonials.map((item) => (
              <article
                key={item.name}
                className="rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-1 hover:border-foreground/20"
              >
                <p className="text-sm text-muted-foreground">&ldquo;{item.text}&rdquo;</p>
                <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {item.name} · {item.study}
                </p>
              </article>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border bg-accent/30 p-4 text-center text-accent-foreground">
                <p className="text-2xl font-semibold">{stat.value}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="preise" className="space-y-8">
          <div className="flex items-end justify-between gap-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Preise
              </p>
              <h2 className="text-3xl font-semibold">Fair, klar, studierendengerecht.</h2>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:border-foreground/20">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Free
              </p>
              <h3 className="mt-3 text-2xl font-semibold">Für den Einstieg</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Begrenzte Uploads und Basisfeedback für schnelle Sessions.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Bis zu 1 Deck</li>
                <li>Basis-Feedback</li>
                <li>Standard-Export</li>
              </ul>
              <Link
                href="/auth/sign-in"
                className="mt-6 inline-flex rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-foreground/30"
              >
                Kostenlos starten
              </Link>
            </article>
            <article className="rounded-3xl border border-primary/40 bg-primary/10 p-6 shadow-sm transition hover:-translate-y-1 hover:border-primary/60">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Pro
              </p>
              <h3 className="mt-3 text-2xl font-semibold">Für Fokus-Prüfungen</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Mehr Uploads, tiefere Auswertung, Export & Analysen.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Mehrere Decks & Uploads</li>
                <li>Erweiterte Analyse</li>
                <li>Export & Lernverlauf</li>
              </ul>
              <Link
                href="/auth/sign-in"
                className="mt-6 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                Pro testen
              </Link>
            </article>
          </div>
        </section>

        <section className="space-y-8">
          <div className="flex items-end justify-between gap-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                FAQ
              </p>
              <h2 className="text-3xl font-semibold">Alles Wichtige auf einen Blick.</h2>
            </div>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="rounded-2xl border border-border bg-card p-4 transition hover:border-foreground/20"
              >
                <summary className="cursor-pointer text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  {faq.question}
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
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

        <footer className="flex flex-col gap-3 border-t border-border/60 pt-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Talk to Learn</p>
          <div className="flex gap-4">
            <Link
              href="https://www.instagram.com/dani.pillwein/"
              className="hover:text-foreground"
            >
              Kontakt
            </Link>
          </div>
        </footer>
        </div>
      </div>
    </main>
  );
}
