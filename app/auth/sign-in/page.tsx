"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignInPage(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const user = session?.user;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const callbackParam = searchParams.get("callbackUrl");
  const callbackUrl =
    callbackParam && callbackParam.startsWith("/") ? callbackParam : "/app/learn";

  useEffect(() => {
    if (status === "authenticated" && callbackParam) {
      router.replace(callbackUrl);
    }
  }, [status, router, callbackUrl, callbackParam]);

  if (status === "loading") {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground md:py-16">
        <Card className="relative w-full max-w-md bg-card p-6 text-center border-0 shadow-none">
          <div className="flex flex-col items-center gap-4">
            <span className="session-loader" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              kurze Pause für dich :) 
              <br/><br/>
              Checken gerade, ob du schon angemeldet bist...
            </p>
          </div>
        </Card>
      </main>
    );
  }

  if (user) {
    return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-6 pt-6 pb-12 text-foreground md:py-16">
        <Card className="relative w-full max-w-4xl overflow-visible border-0 bg-card md:border-2 md:border-border md:shadow-sm md:shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
          <div className="flex flex-col gap-0 md:grid md:grid-cols-[minmax(0,1fr)_320px] md:gap-6">
            <div className="order-2 rounded-2xl border-2 border-border p-6 shadow-[0_12px_30px_rgba(0,0,0,0.12)] md:order-1 md:border-0 md:p-8 md:shadow-none">
              <CardHeader className="space-y-3 text-center md:text-left">
                <div className="mx-auto inline-flex w-fit max-w-max items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground shadow-sm md:mx-0">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Upload → Fragen → Erklären
                </div>
                <CardTitle className="text-3xl font-bold">
                  Schön dich wieder zu sehen!
                </CardTitle>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Du bist angemeldet als{" "}
                  <span className="font-semibold text-foreground">
                    {user.name ?? user.email ?? "Account"}
                  </span>
                  .
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-2 md:pt-4">
                <LoadingButton
                  className="w-full bg-primary text-primary-foreground"
                  href="/app/learn"
                  text="Weiter zum Lernen"
                />
                <LoadingButton
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (isSigningOut) return;
                    setIsSigningOut(true);
                    void signOut({ callbackUrl: "/auth/sign-in" });
                  }}
                  isLoading={isSigningOut}
                  loadingText="Abmelden"
                  text="Mit anderem Konto fortfahren"
                />
              </CardContent>
            </div>
            <div className="order-1 relative min-h-[200px] overflow-visible bg-success/40 md:order-2 md:min-h-[260px] md:border-l-2 md:border-border">
              <Image
                src="/mascot/otter-wave.png"
                alt="Otter winkt"
                fill
                sizes="(max-width: 1024px) 40vw, 320px"
                className="object-contain object-bottom px-4 pt-2 pb-0 translate-y-[18px] md:translate-y-[25px]"
                priority
              />
            </div>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-6 pt-6 pb-12 text-foreground md:py-16">
      <Card className="relative w-full max-w-4xl overflow-visible border-0 bg-card md:border-2 md:border-border md:shadow-sm md:shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
        <div className="flex flex-col gap-0 md:grid md:grid-cols-[minmax(0,1fr)_320px] md:gap-6">
          <div className="order-2 rounded-2xl border-2 border-border p-6 shadow-[0_12px_30px_rgba(0,0,0,0.12)] md:order-1 md:border-0 md:p-8 md:shadow-none">
            <CardHeader className="space-y-3 text-center md:text-left">
              <div className="mx-auto inline-flex w-fit max-w-max items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground shadow-sm md:mx-0">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Upload → Fragen → Erklären
              </div>
              <CardTitle className="text-3xl font-bold">
                Hello, was geht :)
              </CardTitle>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Ein Klick mit Google – wir erkennen automatisch, ob du neu bist oder dich einloggst.
              </p>
            </CardHeader>
            <CardContent className="space-y-5 pt-2 md:pt-4">
          <LoadingButton
            className="w-full bg-primary text-primary-foreground"
            onClick={() => {
              if (isSubmitting) return;
              setIsSubmitting(true);
              void signIn("google", { callbackUrl });
                }}
                isLoading={isSubmitting}
                loadingText="Du wirst gleich weitergeleitet"
                text="Mit Google fortfahren"
              />

              <div className="text-center text-sm text-muted-foreground md:text-left">
                Noch unsicher?{" "}
                {/* TODO: Zu Demo-Abschnitt weiterleiten */}
                <Link className="text-foreground underline" href="/">
                  Demo anschauen
                </Link>
              </div>
            </CardContent>
          </div>
          <div className="order-1 relative min-h-[200px] overflow-visible bg-success/40 md:order-2 md:min-h-[260px] md:border-l-2 md:border-border">
            <Image
              src="/mascot/otter-wave.png"
              alt="Otter winkt"
              fill
              sizes="(max-width: 1024px) 40vw, 320px"
              className="object-contain object-bottom px-4 pt-2 pb-0 translate-y-[18px] md:translate-y-[25px]"
              priority
            />
          </div>
        </div>
      </Card>
    </main>
  );
}
