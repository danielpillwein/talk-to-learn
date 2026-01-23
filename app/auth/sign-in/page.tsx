"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignInPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const user = session?.user;

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/app/learn");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground md:py-16">
        <Card className="relative w-full max-w-md border-border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Session wird geladen...</p>
        </Card>
      </main>
    );
  }

  if (user) {
    return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground md:py-16">
        <Card className="relative w-full max-w-md border-border bg-card shadow-sm">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm uppercase tracking-[0.2em] text-muted-foreground shadow-sm">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Talk to Learn
            </div>
            <CardTitle className="text-3xl font-bold">
              Willkommen zurück
            </CardTitle>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Du bist angemeldet als{" "}
              <span className="font-semibold text-foreground">
                {user.name ?? user.email ?? "Account"}
              </span>
              .
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
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
    <main className="relative flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground md:py-16">
      <Card className="relative w-full max-w-md border-border bg-card shadow-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm uppercase tracking-[0.2em] text-muted-foreground shadow-sm">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Talk to Learn
          </div>
          <CardTitle className="text-3xl font-bold">
            Willkommen zurück
          </CardTitle>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Logge dich ein und starte deine nächste Lernsession in Sekunden.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Neu hier?</span>{" "}
            Dein Google-Login erstellt automatisch deinen Account.
          </div>
          <Button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => signIn("google", { callbackUrl: "/app/learn" })}
          >
            Account erstellen
          </Button>

          <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
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

          <div className="text-center text-sm text-muted-foreground">
            Du willst erst schauen?{" "}
            <Link className="text-foreground underline" href="/">
              Zur Projektseite
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
