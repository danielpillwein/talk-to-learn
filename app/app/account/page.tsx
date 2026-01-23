import { auth } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountActions, AvatarBadge } from "./parts";

export default async function AccountPage() {
  const session = await auth();
  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 sm:px-6">
        <Card className="w-full max-w-md border-slate-200 shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-slate-900">
              Bitte anmelden
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-slate-600">
              Du brauchst einen Account, um deine Einstellungen zu sehen.
            </p>
            <Button asChild className="w-full">
              <Link href="/auth/sign-in">Zum Login</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const user = session.user;

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Account
          </p>
          <h1 className="text-3xl font-bold text-slate-900">
            Hallo {user?.name ?? "Lernende:r"}
          </h1>
          <p className="text-sm text-slate-600">
            Verwalte deine Session und gehe direkt zur Lernumgebung.
          </p>
        </header>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Profil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="flex items-center gap-3">
              <AvatarBadge name={user?.name} image={user?.image} />
              <div>
                <div className="text-slate-500">Name</div>
                <div className="font-semibold text-slate-900">
                  {user?.name ?? "—"}
                </div>
              </div>
            </div>
            <div>
              <span className="text-slate-500">E-Mail:</span>{" "}
              {user?.email ?? "—"}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Aktionen
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/app/learn">Zurück zur Lernsession</Link>
            </Button>
            <AccountActions />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
