import Stripe from "stripe";
import Purchase from "../models/Purchase";
import User from "../models/User";
import UsageLedger from "../models/UsageLedger";
import {
  billingCatalog,
  getIncludedCreditsByPriceId,
  getIntervalFromPriceId,
  getPlanKeyFromPriceId,
  getStripeClient,
  isSubscriptionStatusActive,
} from "./stripeService";

const RETRY_DELAYS_MS = [500, 1500, 3000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(fn: () => Promise<T>) {
  let lastError: unknown;

  for (let i = 0; i < RETRY_DELAYS_MS.length; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await sleep(RETRY_DELAYS_MS[i]);
    }
  }

  throw lastError;
}

export async function getOrCreateStripeCustomer(userId: string) {
  const user = await User.findById(userId).select("email name billing");
  if (!user) {
    throw new Error("User not found");
  }

  if (user.billing?.stripeCustomerId) {
    return user.billing.stripeCustomerId;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user._id.toString() },
  });

  const billing = ensureBilling(user);
  billing.stripeCustomerId = customer.id;
  await user.save();

  return customer.id;
}

export async function reportUsageEvent(params: {
  userId: string;
  quantity: number;
  sourceEventId: string;
}) {
  const usageRow = await UsageLedger.findOneAndUpdate(
    { sourceEventId: params.sourceEventId },
    {
      $setOnInsert: {
        userId: params.userId,
        metric: "credits",
        quantity: params.quantity,
        sourceEventId: params.sourceEventId,
        status: "pending",
      },
    },
    { upsert: true, new: true }
  );

  if (usageRow.status === "sent") {
    return usageRow;
  }

  const user = await User.findById(params.userId).select("billing");
  if (!user?.billing?.stripeCustomerId) {
    usageRow.status = "failed";
    await usageRow.save();
    throw new Error("User does not have a Stripe customer yet");
  }

  const stripe = getStripeClient();
  try {
    const meterEvent = await retryWithBackoff(() =>
      stripe.billing.meterEvents.create({
        event_name: billingCatalog.usage.meterEventName,
        payload: {
          stripe_customer_id: user.billing!.stripeCustomerId!,
          value: String(params.quantity),
        },
        identifier: params.sourceEventId,
      })
    );

    usageRow.status = "sent";
    usageRow.stripeMeterEventId = meterEvent.identifier;
    await usageRow.save();

    user.billing.usedCredits = (user.billing.usedCredits ?? 0) + params.quantity;
    await user.save();

    return usageRow;
  } catch (error) {
    usageRow.status = "failed";
    await usageRow.save();
    throw error;
  }
}

export function formatBillingStatus(user: {
  billing?: {
    subscriptionStatus?: string;
    subscriptionPriceId?: string;
    currentPeriodEnd?: Date;
    creditBalance?: number;
    includedCredits?: number;
    usedCredits?: number;
  };
}) {
  const includedCredits = user.billing?.includedCredits ?? 0;
  const usedCredits = user.billing?.usedCredits ?? 0;
  const remaining = Math.max(includedCredits - usedCredits, 0) + (user.billing?.creditBalance ?? 0);

  const status = user.billing?.subscriptionStatus ?? "inactive";
  const priceId = user.billing?.subscriptionPriceId ?? null;
  const activePlanKey =
    isSubscriptionStatusActive(status) && priceId ? getPlanKeyFromPriceId(priceId) : null;
  const activeInterval =
    isSubscriptionStatusActive(status) && priceId ? getIntervalFromPriceId(priceId) : null;

  return {
    subscriptionStatus: status,
    subscriptionPriceId: priceId,
    currentPeriodEnd: user.billing?.currentPeriodEnd ?? null,
    activePlanKey,
    activeInterval,
    credits: {
      included: includedCredits,
      used: usedCredits,
      remaining,
    },
  };
}

export function ensureBilling(user: {
  billing?: {
    stripeCustomerId?: string;
    subscriptionId?: string;
    subscriptionItemId?: string;
    subscriptionStatus?: string;
    subscriptionPriceId?: string;
    currentPeriodEnd?: Date;
    includedCredits?: number;
    usedCredits?: number;
    creditBalance?: number;
  };
}) {
  if (!user.billing) {
    user.billing = {};
  }

  if (typeof user.billing.includedCredits !== "number") {
    user.billing.includedCredits = 0;
  }
  if (typeof user.billing.usedCredits !== "number") {
    user.billing.usedCredits = 0;
  }
  if (typeof user.billing.creditBalance !== "number") {
    user.billing.creditBalance = 0;
  }

  return user.billing as {
    stripeCustomerId?: string;
    subscriptionId?: string;
    subscriptionItemId?: string;
    subscriptionStatus?: string;
    subscriptionPriceId?: string;
    currentPeriodEnd?: Date;
    includedCredits: number;
    usedCredits: number;
    creditBalance: number;
  };
}

export function updateUserBillingFromSubscription(
  user: {
    billing?: {
      subscriptionId?: string;
      subscriptionItemId?: string;
      subscriptionStatus?: string;
      subscriptionPriceId?: string;
      currentPeriodEnd?: Date;
      includedCredits?: number;
      usedCredits?: number;
    };
  },
  subscription: Stripe.Subscription
) {
  const billing = ensureBilling(user);
  const priceId = subscription.items.data[0]?.price.id;
  const periodEndUnix = (subscription as Stripe.Subscription & { current_period_end?: number })
    .current_period_end;
  billing.subscriptionId = subscription.id;
  billing.subscriptionItemId = subscription.items.data[0]?.id;
  billing.subscriptionStatus = subscription.status;
  billing.subscriptionPriceId = priceId;
  if (periodEndUnix) {
    billing.currentPeriodEnd = new Date(periodEndUnix * 1000);
  }
  billing.includedCredits = getIncludedCreditsByPriceId(priceId);
  billing.usedCredits = 0;
}

export async function upsertDigitalPurchase(params: {
  userId: string;
  checkoutSessionId: string;
  paymentIntentId?: string;
  invoiceId?: string;
  productKey: string;
  priceId: string;
  amountTotal: number;
  currency: string;
  status: "pending" | "paid" | "failed";
}) {
  return Purchase.findOneAndUpdate(
    { stripeCheckoutSessionId: params.checkoutSessionId },
    {
      $set: {
        userId: params.userId,
        productKey: params.productKey,
        stripePaymentIntentId: params.paymentIntentId,
        stripeInvoiceId: params.invoiceId,
        priceId: params.priceId,
        amountTotal: params.amountTotal,
        currency: params.currency,
        status: params.status,
        fulfilledAt: params.status === "paid" ? new Date() : undefined,
      },
    },
    { upsert: true, new: true }
  );
}
