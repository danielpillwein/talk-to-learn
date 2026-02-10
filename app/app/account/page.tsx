import { auth } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountActions, AvatarBadge } from "./parts";

export default async function AccountPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center py-10">
        <Card className="w-full max-w-md border-border shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-foreground">
              Bitte anmelden
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Du brauchst einen Account, um deine Einstellungen zu sehen.
            </p>
            <Button asChild className="w-full">
              <Link href="/auth/sign-in">Login / Registrieren</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const user = session.user;

  return (
    <main className="py-10">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 rounded-3xl border border-border bg-card px-6 py-5 shadow-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Account
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            Hallo {user?.name ?? "Lernende:r"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Verwalte deine Session und gehe direkt zur Lernumgebung.
          </p>
        </header>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Profil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground">
            <div className="flex items-center gap-3">
              <AvatarBadge name={user?.name} image={user?.image} />
              <div>
                <div className="text-muted-foreground">Name</div>
                <div className="font-semibold text-foreground">
                  {user?.name ?? "—"}
                </div>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">E-Mail:</span>{" "}
              {user?.email ?? "—"}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Aktionen
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row">
            <Button asChild className="w-full md:w-auto">
              <Link href="/app/learn">Zurück zur Lernsession</Link>
            </Button>
            <Button asChild variant="outline" className="w-full md:w-auto">
              <Link href="/app/create">Neues Lernset erstellen</Link>
            </Button>
            <AccountActions />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
