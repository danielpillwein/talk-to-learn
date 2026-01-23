import Link from "next/link";
import type { Metadata } from "next";

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

export default function LandingPage() {
  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-12 md:gap-16 md:py-24">
          <header className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm uppercase tracking-[0.2em] text-muted-foreground shadow-sm">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Talk to Learn
              </div>
              <h1 className="text-4xl font-bold leading-tight md:text-6xl">
                Lerne laut, statt still zu scrollen.
              </h1>
              <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
                Deine Stimme ist der schnellste Weg ins Langzeitgedächtnis.
                Talk to Learn macht aus Skripten kurze, sprechbasierte
                Lernsessions mit sofortigem Feedback und klarem Lernrhythmus.
              </p>
              <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
                <Link
                  href="/auth/sign-in"
                  className="w-full rounded-xl bg-primary px-6 py-3 text-center text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 md:w-auto"
                >
                  Kostenlos starten
                </Link>
                <Link
                  href="/app/learn"
                  className="w-full rounded-xl border border-border bg-card px-6 py-3 text-center text-sm font-semibold text-foreground shadow-sm transition hover:border-foreground/20 md:w-auto"
                >
                  Demo ansehen
                </Link>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>5-Minuten-Sessions</span>
                <span>Audio-first</span>
                <span>Sofortiges Feedback</span>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                  Fokus
                </p>
                <h2 className="text-2xl font-bold">
                  Für Studierende, die mehr als Karteikarten wollen.
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Nutze Sprechen als aktives Abrufen: schnelleres Verstehen,
                  weniger Vergessen und besseres Klausur-Feeling.
                </p>
                <div className="grid gap-3 text-sm">
                  {[
                    "AI bewertet deine Antwort in Sekunden",
                    "Spaced-Repetition passt sich deinem Level an",
                    "Lernsets aus deinen Skripten",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2"
                    >
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </header>

          <section className="grid gap-5 lg:grid-cols-3">
            {[
              {
                title: "Sprechen statt Tippen",
                text: "Du trainierst echte Prüfungssituationen, nicht nur das Wiedererkennen.",
              },
              {
                title: "Direktes Feedback",
                text: "AI zeigt dir sofort, was fehlt, und hilft beim Nachbessern.",
              },
              {
                title: "Smarter Lernrhythmus",
                text: "Schwierige Fragen kommen früher zurück, leichte später.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <h3 className="text-xl font-semibold">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                So funktioniert's
              </p>
              <h2 className="text-3xl font-bold">
                In 3 Schritten zur Fokus-Session
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Kurz, klar, messbar: jede Session bringt dich näher an echte
                Klausurperformance.
              </p>
            </div>
            <div className="space-y-4">
              {[
                "Lernset auswählen oder importieren",
                "Antworten laut sprechen",
                "Feedback nutzen und Fortschritt sehen",
              ].map((step, index) => (
                <div
                  key={step}
                  className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {index + 1}
                  </div>
                  <p className="text-sm text-muted-foreground">{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-3">
            {[
              {
                title: "BWL Master, 4. Semester",
                text: '"Endlich ein Tool, das mich zum Sprechen zwingt. Genau so fühlt sich die mündliche Prüfung an."',
              },
              {
                title: "Informatik, 2. Semester",
                text: '"5 Minuten reichen, um eine Karte wirklich zu verstehen. Das Feedback ist brutal ehrlich."',
              },
              {
                title: "Medizin, 1. Staatsexamen",
                text: '"Spaced Repetition ist hier endlich sinnvoll umgesetzt. Ich verliere keine Zeit mehr."',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <p className="text-sm text-muted-foreground">{item.text}</p>
                <p className="mt-4 text-sm uppercase tracking-[0.2em] text-muted-foreground">
                  {item.title}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <h2 className="text-3xl font-bold">
                  Starte jetzt mit deinem ersten Lernlauf.
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Kostenlos testen und sehen, wie schnell sich Lernen anfühlt,
                  wenn du laut sprichst.
                </p>
              </div>
              <Link
                href="/auth/sign-in"
                className="w-full rounded-xl bg-primary px-6 py-3 text-center text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 lg:w-auto"
              >
                Zum Login
              </Link>
            </div>
          </section>
      </div>
    </main>
  );
}
