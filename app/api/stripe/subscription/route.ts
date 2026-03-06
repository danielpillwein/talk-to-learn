import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isStripeConfigured, setSubscriptionCancelAtPeriodEndByEmail } from "@/lib/stripe-server";

type SubscriptionAction = "cancel" | "resume";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await auth();
    const userEmail = String(session?.user?.email ?? "").trim();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!userEmail) {
      return NextResponse.json({ error: "Keine E-Mail für das Abo vorhanden." }, { status: 400 });
    }
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe Billing ist nicht konfiguriert." }, { status: 400 });
    }

    const payload = (await request.json().catch(() => null)) as { action?: string } | null;
    const action = String(payload?.action ?? "").trim().toLowerCase() as SubscriptionAction;
    if (action !== "cancel" && action !== "resume") {
      return NextResponse.json({ error: "Ungültige Abo-Aktion." }, { status: 400 });
    }

    const snapshot = await setSubscriptionCancelAtPeriodEndByEmail(userEmail, action === "cancel");
    if (!snapshot) {
      return NextResponse.json({ error: "Kein aktives Abo für diesen Account gefunden." }, { status: 404 });
    }

    return NextResponse.json({
      plan: snapshot.plan,
      status: snapshot.status,
      currentPeriodEnd: snapshot.currentPeriodEnd,
      nextBillingAt: snapshot.nextBillingAt,
      billingInterval: snapshot.billingInterval,
    });
  } catch (error) {
    console.error("Error updating subscription cancellation:", error);
    return NextResponse.json({ error: "Abo-Status konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

