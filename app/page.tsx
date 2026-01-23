import Link from "next/link";
import type { Metadata } from "next";
import { Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body" });

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
    <main
      className={`${display.variable} ${body.variable} bg-[#f7f7fb] text-slate-900`}
    >
      <div className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[-10%] top-[-30%] h-[520px] w-[520px] rounded-full bg-gradient-to-br from-[#ffecd2] via-[#fcb69f] to-[#f6d365] opacity-60 blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[-15%] top-[10%] h-[560px] w-[560px] rounded-full bg-gradient-to-br from-[#a1c4fd] via-[#c2e9fb] to-[#d4fc79] opacity-50 blur-[140px]"
        />

        <div className="mx-auto flex max-w-6xl flex-col gap-12 px-5 py-12 sm:px-6 md:gap-16 md:py-24">
          <header className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-500 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                Talk to Learn
              </div>
              <h1 className="font-[family-name:var(--font-display)] text-4xl font-black leading-tight md:text-6xl">
                Lerne laut, statt still zu scrollen.
              </h1>
              <p className="font-[family-name:var(--font-body)] text-base leading-relaxed text-slate-600 sm:text-lg">
                Deine Stimme ist der schnellste Weg ins Langzeitgedächtnis.
                Talk to Learn macht aus Skripten kurze, sprechbasierte
                Lernsessions mit sofortigem Feedback und klarem Lernrhythmus.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/auth/sign-in"
                  className="w-full rounded-xl bg-slate-900 px-6 py-3 text-center text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 sm:w-auto"
                >
                  Kostenlos starten
                </Link>
                <Link
                  href="/app/learn"
                  className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900 sm:w-auto"
                >
                  Demo ansehen
                </Link>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                <span>5-Minuten-Sessions</span>
                <span>Audio-first</span>
                <span>Sofortiges Feedback</span>
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Fokus
                </p>
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">
                  Für Studierende, die mehr als Karteikarten wollen.
                </h2>
                <p className="text-sm leading-relaxed text-slate-600">
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
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                      <span className="text-slate-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </header>

          <section className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
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
                className="rounded-2xl border border-white/70 bg-white/90 p-5 shadow-lg"
              >
                <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm text-slate-600">{item.text}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-center">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                So funktioniert's
              </p>
              <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold">
                In 3 Schritten zur Fokus-Session
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
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
                  className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm text-slate-600">{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
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
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <p className="text-sm text-slate-600">{item.text}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-400">
                  {item.title}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold">
                  Starte jetzt mit deinem ersten Lernlauf.
                </h2>
                <p className="text-sm leading-relaxed text-slate-600">
                  Kostenlos testen und sehen, wie schnell sich Lernen anfühlt,
                  wenn du laut sprichst.
                </p>
              </div>
              <Link
                href="/auth/sign-in"
                className="w-full rounded-xl bg-slate-900 px-6 py-3 text-center text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 md:w-auto"
              >
                Zum Login
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
