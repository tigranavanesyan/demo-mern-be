import { billingCatalog } from "./stripeService";

export type BillingInterval = "monthly" | "yearly";
export type BillingPlanKey = keyof typeof billingCatalog.plans;
export type BillingMode = "subscription" | "one_time";
export type BillingProductKey = keyof typeof billingCatalog.oneTimeProducts;

export function parseCheckoutMode(mode: unknown): BillingMode | null {
  if (mode === "subscription" || mode === "one_time") {
    return mode;
  }
  return null;
}

export function parseBillingInterval(interval: unknown): BillingInterval | null {
  if (interval === "monthly" || interval === "yearly") {
    return interval;
  }
  return null;
}

export function parsePlanKey(planKey: unknown): BillingPlanKey | null {
  if (typeof planKey !== "string") {
    return null;
  }
  return planKey in billingCatalog.plans ? (planKey as BillingPlanKey) : null;
}

export function parseProductKey(productKey: unknown): BillingProductKey | null {
  if (typeof productKey !== "string") {
    return null;
  }
  return productKey in billingCatalog.oneTimeProducts ? (productKey as BillingProductKey) : null;
}

export function validateUsageRecord(quantity: unknown, sourceEventId: unknown) {
  if (!Number.isInteger(quantity) || Number(quantity) < 1) {
    return "quantity must be a positive integer";
  }
  if (typeof sourceEventId !== "string" || sourceEventId.length < 8) {
    return "sourceEventId is required and must be unique";
  }
  return null;
}
