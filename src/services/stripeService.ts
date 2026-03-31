import Stripe from "stripe";
import { env } from "../config/env";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia",
    });
  }

  return stripeClient;
}

export const billingCatalog = {
  plans: {
    starter: {
      monthlyPriceId: env.STRIPE_PRICE_STARTER_MONTHLY,
      yearlyPriceId: env.STRIPE_PRICE_STARTER_YEARLY,
      includedCredits: 1000,
    },
    pro: {
      monthlyPriceId: env.STRIPE_PRICE_PRO_MONTHLY,
      yearlyPriceId: env.STRIPE_PRICE_PRO_YEARLY,
      includedCredits: 5000,
    },
    enterprise: {
      monthlyPriceId: env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
      yearlyPriceId: env.STRIPE_PRICE_ENTERPRISE_YEARLY,
      includedCredits: 15000,
    },
  },
  oneTimeProducts: {
    premium_template: {
      priceId: env.STRIPE_ONE_TIME_PREMIUM_TEMPLATE_PRICE,
      name: "Premium Template",
    },
  },
  usage: {
    meterEventName: env.STRIPE_CREDIT_USAGE_METER_EVENT,
    overagePriceId: env.STRIPE_CREDIT_OVERAGE_PRICE,
  },
};

type PlanKey = keyof typeof billingCatalog.plans;
type Interval = "monthly" | "yearly";

export function getPriceIdForPlan(planKey: PlanKey, interval: Interval) {
  const plan = billingCatalog.plans[planKey];
  if (!plan) {
    throw new Error("Invalid plan key");
  }

  const priceId = interval === "yearly" ? plan.yearlyPriceId : plan.monthlyPriceId;
  if (!priceId) {
    throw new Error(`Missing Stripe price for ${planKey} ${interval}`);
  }

  return priceId;
}

export function getIncludedCreditsByPriceId(priceId?: string) {
  if (!priceId) {
    return 0;
  }

  for (const plan of Object.values(billingCatalog.plans)) {
    if (plan.monthlyPriceId === priceId || plan.yearlyPriceId === priceId) {
      return plan.includedCredits;
    }
  }

  return 0;
}
