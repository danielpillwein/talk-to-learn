import "server-only";

import Stripe from "stripe";

const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY ?? "").trim();

if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY fehlt. Stripe-Funktionen sind deaktiviert.");
}

export const stripe = new Stripe(stripeSecretKey || "sk_test_disabled", {
  apiVersion: "2024-06-20",
});
