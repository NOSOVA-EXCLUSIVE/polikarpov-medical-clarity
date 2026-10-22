import "server-only";

import type Stripe from "stripe";

import { env } from "@/lib/env/server";
import { assertPreviewAllowedOperation } from "@/lib/preview/guard";

let stripeClient: Stripe | null = null;

export function getStripe() {
  assertPreviewAllowedOperation("payments:stripe");
  if (!stripeClient) {
    const stripeModule = require("stripe");
    const StripeConstructor = stripeModule.default ?? stripeModule;
    stripeClient = new StripeConstructor(env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
}
