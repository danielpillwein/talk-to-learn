import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";

type LegalPageLayoutProps = {
  title: string;
  children: ReactNode;
};

export function LegalPageLayout({ title, children }: LegalPageLayoutProps): JSX.Element {
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
            <span className="max-w-[140px] truncate text-base sm:max-w-none">Talk-to-Learn</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/"
              className="hidden rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 md:inline-flex"
            >
              Zur Startseite
            </Link>
          </div>
        </div>
      </nav>

      <div className="overflow-x-hidden pt-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-12 md:gap-24 md:py-20">
          <article className="w-full rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
            <header className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rechtliches</p>
              <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
            </header>
            <div className="mt-8 space-y-8">{children}</div>
          </article>

          <SiteFooter className="w-full" />
        </div>
      </div>
    </main>
  );
}
