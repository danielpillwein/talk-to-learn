import { auth } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountDashboardClient } from "./account-dashboard-client";

export default async function AccountPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center py-10">
        <Card className="w-full max-w-md border-border shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-foreground">Bitte anmelden</CardTitle>
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

  return (
    <AccountDashboardClient
      initialName={session.user?.name}
      email={session.user?.email}
      image={session.user?.image}
    />
  );
}
