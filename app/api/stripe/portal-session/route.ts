import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createStripeBillingPortalSession, findStripeCustomerByEmail, isStripeConfigured } from "@/lib/stripe-server";

function resolveReturnUrl(request: Request): string {
  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  return `${origin.replace(/\/$/, "")}/app/account`;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await auth();
    const userEmail = String(session?.user?.email ?? "").trim();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!userEmail) {
      return NextResponse.json({ error: "Keine E-Mail für das Billing Portal vorhanden." }, { status: 400 });
    }
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe Billing ist nicht konfiguriert." }, { status: 400 });
    }

    const customer = await findStripeCustomerByEmail(userEmail);
    if (!customer?.id) {
      return NextResponse.json({ error: "Kein Stripe-Kunde für diesen Account gefunden." }, { status: 404 });
    }

    const url = await createStripeBillingPortalSession(customer.id, resolveReturnUrl(request));
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error creating Stripe portal session:", error);
    return NextResponse.json({ error: "Billing Portal konnte nicht geöffnet werden." }, { status: 500 });
  }
}

