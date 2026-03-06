import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/src/lib/stripe";

export const runtime = "nodejs";

function resolveReturnUrl(): string {
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000")
    .trim()
    .replace(/\/$/, "");
  return `${appUrl}/app/account`;
}

async function getUserColumns(): Promise<Set<string>> {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("User")`);
    return new Set(rows.map((entry) => String(entry.name)));
  } catch {
    return new Set<string>();
  }
}

export async function POST(): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = String(session?.user?.id ?? "").trim();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (String(process.env.STRIPE_SECRET_KEY ?? "").trim().length === 0) {
      return NextResponse.json({ error: "Stripe Billing ist nicht konfiguriert." }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "Account nicht gefunden." }, { status: 404 });
    }

    const userColumns = await getUserColumns();
    const hasStripeCustomerIdColumn = userColumns.has("stripeCustomerId");
    let customerId = "";
    if (hasStripeCustomerIdColumn) {
      const rows = await db.$queryRawUnsafe<Array<{ stripeCustomerId: string | null }>>(
        `SELECT "stripeCustomerId" FROM "User" WHERE "id" = ? LIMIT 1`,
        user.id
      );
      customerId = String(rows[0]?.stripeCustomerId ?? "").trim();
    }

    if (!customerId && user.email) {
      const customerList = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });
      customerId = String(customerList.data[0]?.id ?? "").trim();
      if (customerId && hasStripeCustomerIdColumn) {
        await db.user.update({
          where: { id: user.id },
          data: { stripeCustomerId: customerId },
        } as any);
      }
    }

    if (!customerId) {
      return NextResponse.json({ error: "Kein Stripe-Kunde für diesen Account gefunden." }, { status: 404 });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: resolveReturnUrl(),
    });
    const url = String(portal.url ?? "").trim();
    if (!url) {
      return NextResponse.json({ error: "Billing Portal URL konnte nicht erstellt werden." }, { status: 500 });
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error creating Stripe portal session:", error);
    return NextResponse.json({ error: "Billing Portal konnte nicht geöffnet werden." }, { status: 500 });
  }
}
