"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignInPage() {
  const { data: session } = useSession();
  const user = session?.user;

  if (user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-[#f7f7fb] px-5 py-12 text-slate-900 sm:px-6 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[-10%] top-[-30%] h-[420px] w-[420px] rounded-full bg-gradient-to-br from-[#ffecd2] via-[#fcb69f] to-[#f6d365] opacity-60 blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[-15%] top-[10%] h-[520px] w-[520px] rounded-full bg-gradient-to-br from-[#a1c4fd] via-[#c2e9fb] to-[#d4fc79] opacity-50 blur-[140px]"
        />

        <Card className="relative w-full max-w-md border-white/70 bg-white/90 shadow-xl backdrop-blur">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-500 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
              Talk to Learn
            </div>
            <CardTitle className="text-3xl font-black">
              Willkommen zurück
            </CardTitle>
            <p className="text-sm leading-relaxed text-slate-600">
              Du bist angemeldet als{" "}
              <span className="font-semibold text-slate-900">
                {user.name ?? user.email ?? "Account"}
              </span>
              .
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild className="w-full bg-slate-900 text-white hover:bg-slate-800">
              <Link href="/app/learn">Weiter zum Lernen</Link>
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => signOut({ callbackUrl: "/auth/sign-in" })}
            >
              Mit anderem Konto fortfahren
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#f7f7fb] px-5 py-12 text-slate-900 sm:px-6 sm:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[-10%] top-[-30%] h-[420px] w-[420px] rounded-full bg-gradient-to-br from-[#ffecd2] via-[#fcb69f] to-[#f6d365] opacity-60 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-15%] top-[10%] h-[520px] w-[520px] rounded-full bg-gradient-to-br from-[#a1c4fd] via-[#c2e9fb] to-[#d4fc79] opacity-50 blur-[140px]"
      />

      <Card className="relative w-full max-w-md border-white/70 bg-white/90 shadow-xl backdrop-blur">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-500 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
            Talk to Learn
          </div>
          <CardTitle className="text-3xl font-black">
            Willkommen zurück
          </CardTitle>
          <p className="text-sm leading-relaxed text-slate-600">
            Logge dich ein und starte deine nächste Lernsession in Sekunden.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">
              Neu hier?
            </span>{" "}
            Dein Google-Login erstellt automatisch deinen Account.
          </div>
          <Button
            className="w-full bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => signIn("google", { callbackUrl: "/app/learn" })}
          >
            Account erstellen
          </Button>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">
              Schon registriert?
            </span>{" "}
            Melde dich mit demselben Google-Konto an.
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => signIn("google", { callbackUrl: "/app/learn" })}
          >
            Anmelden
          </Button>

          <div className="text-center text-xs text-slate-500">
            Du willst erst schauen?{" "}
            <Link className="text-slate-900 underline" href="/">
              Zur Projektseite
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
