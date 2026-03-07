import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Preise – Talk to Learn",
};

export default function PricingPage(): JSX.Element {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl items-center px-6 py-10">
      <Card className="w-full border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-foreground">Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upgrade-Flows werden hier bereitgestellt. Aktuell kannst du dein Abo direkt im Account-Dashboard verwalten.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/app/account#abo">Zum Account-Dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/learn">Zur Lernsession</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

