import Link from "next/link";

export default function NotFound(): JSX.Element {
  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-6 py-20">
        <section className="rounded-3xl border border-border bg-card p-8 shadow-sm md:p-12">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Fehler 404</p>
          <h1 className="mt-3 text-4xl font-semibold md:text-5xl">Seite nicht gefunden</h1>
          <p className="mt-4 text-sm text-muted-foreground md:text-base">
            Die angeforderte Seite existiert nicht oder wurde entfernt.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full border border-border px-5 py-2 text-sm font-medium hover:bg-accent"
            >
              Zur Startseite
            </Link>
            <Link
              href="/imprint"
              className="rounded-full border border-border px-5 py-2 text-sm font-medium hover:bg-accent"
            >
              Impressum
            </Link>
            <Link
              href="/privacy"
              className="rounded-full border border-border px-5 py-2 text-sm font-medium hover:bg-accent"
            >
              Datenschutz
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
