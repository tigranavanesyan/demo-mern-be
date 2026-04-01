import { Request, Response } from "express";
import Stripe from "stripe";
import Purchase from "../models/Purchase";
import StripeWebhookEvent from "../models/StripeWebhookEvent";
import UsageLedger from "../models/UsageLedger";
import User from "../models/User";
import {
  ensureBilling,
  formatBillingStatus,
  getOrCreateStripeCustomer,
  reportUsageEvent,
  updateUserBillingFromSubscription,
  upsertDigitalPurchase,
} from "../services/billingService";
import { billingCatalog, getPriceIdForPlan, getStripeClient } from "../services/stripeService";
import {
  parseBillingInterval,
  parseCheckoutMode,
  parsePlanKey,
  parseProductKey,
  validateUsageRecord,
} from "../services/billingValidation";
import { env } from "../config/env";

function badRequest(res: Response, message: string) {
  return res.status(400).json({ message });
}

export async function getBillingStatus(req: Request, res: Response) {
  const user = await User.findById(req.userId).select("billing");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const hasMissingPeriodEnd =
    user.billing?.subscriptionStatus === "active" &&
    user.billing?.subscriptionId &&
    !user.billing?.currentPeriodEnd;
  if (hasMissingPeriodEnd) {
    try {
      const subscriptionId = user.billing?.subscriptionId;
      if (!subscriptionId) {
        throw new Error("Missing subscription id");
      }
      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const periodEndUnix = (subscription as Stripe.Subscription & { current_period_end?: number })
        .current_period_end;
      if (periodEndUnix) {
        const billing = ensureBilling(user);
        billing.currentPeriodEnd = new Date(periodEndUnix * 1000);
        await user.save();
      }
    } catch {
      // Keep response resilient even if Stripe sync fails.
    }
  }

  const latestPurchases = await Purchase.find({ userId: user._id, status: "paid" })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("productKey amountTotal currency status fulfilledAt");
  const usageHistory = await UsageLedger.find({ userId: user._id, metric: "credits" })
    .sort({ createdAt: -1 })
    .limit(15)
    .select("quantity status sourceEventId createdAt");

  return res.json({
    billing: formatBillingStatus(user),
    purchases: latestPurchases,
    usageHistory,
  });
}

export async function createCheckoutSession(req: Request, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const { mode, interval, planKey, productKey } = req.body as {
    mode?: string;
    interval?: string;
    planKey?: string;
    productKey?: string;
  };

  const safeMode = parseCheckoutMode(mode);
  if (!safeMode) {
    return badRequest(res, "Invalid checkout mode");
  }

  const stripe = getStripeClient();
  const user = await User.findById(req.userId).select("email name billing");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const customerId = await getOrCreateStripeCustomer(user._id.toString());

  if (safeMode === "subscription") {
    const safePlanKey = parsePlanKey(planKey);
    const safeInterval = parseBillingInterval(interval);
    if (!safePlanKey || !safeInterval) {
      return badRequest(res, "planKey and interval are required for subscription mode");
    }

    const priceId = getPriceIdForPlan(safePlanKey, safeInterval);
    if (user.billing?.subscriptionId && user.billing.subscriptionItemId) {
      const updated = await stripe.subscriptions.update(user.billing.subscriptionId, {
        items: [{ id: user.billing.subscriptionItemId, price: priceId }],
        proration_behavior: "always_invoice",
      });

      updateUserBillingFromSubscription(user, updated);
      await user.save();

      return res.json({
        updated: true,
        message: "Subscription updated with proration invoice.",
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      success_url: `${env.CLIENT_APP_URL}/billing?status=success`,
      cancel_url: `${env.CLIENT_APP_URL}/pricing?status=cancel`,
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        userId: user._id.toString(),
        mode: "subscription",
        planKey: safePlanKey,
        interval: safeInterval,
      },
      allow_promotion_codes: true,
    });

    return res.json({ url: session.url });
  }

  const safeProductKey = parseProductKey(productKey);
  if (!safeProductKey) {
    return badRequest(res, "Invalid productKey for one_time mode");
  }

  const product = billingCatalog.oneTimeProducts[safeProductKey];
  const oneTimeSession = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${env.CLIENT_APP_URL}/billing?purchase=success`,
    cancel_url: `${env.CLIENT_APP_URL}/pricing?purchase=cancel`,
    customer: customerId,
    line_items: [{ price: product.priceId, quantity: 1 }],
    metadata: {
      userId: user._id.toString(),
      mode: "one_time",
      productKey: safeProductKey,
    },
    allow_promotion_codes: true,
  });

  return res.json({ url: oneTimeSession.url });
}

export async function createPortalSession(req: Request, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const user = await User.findById(req.userId).select("billing");
  if (!user?.billing?.stripeCustomerId) {
    return badRequest(res, "No billing customer found for current user");
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: user.billing.stripeCustomerId,
    return_url: `${env.CLIENT_APP_URL}/billing`,
  });

  return res.json({ url: session.url });
}

async function handleCheckoutCompleted(event: Stripe.Event) {
  const stripe = getStripeClient();
  const session = event.data.object as Stripe.Checkout.Session;
  if (!session.metadata?.userId) {
    return;
  }

  const user = await User.findById(session.metadata.userId).select("billing");
  if (!user) {
    return;
  }

  const billing = ensureBilling(user);
  if (session.customer && typeof session.customer === "string") {
    billing.stripeCustomerId = session.customer;
  }

  if (session.mode === "subscription" && session.subscription) {
    const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    const subscription = await stripe.subscriptions.retrieve(subId);
    updateUserBillingFromSubscription(user, subscription);
  }

  if (session.mode === "payment") {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    const firstItem = lineItems.data[0];
    const productKey = session.metadata.productKey ?? "premium_template";
    const priceId = firstItem?.price?.id ?? "";
    await upsertDigitalPurchase({
      userId: user._id.toString(),
      checkoutSessionId: session.id,
      paymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
      invoiceId: typeof session.invoice === "string" ? session.invoice : session.invoice?.id,
      productKey,
      priceId,
      amountTotal: session.amount_total ?? 0,
      currency: session.currency ?? "usd",
      status: "paid",
    });
  }

  await user.save();
}

async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const user = await User.findOne({ "billing.stripeCustomerId": customerId }).select("billing");
  if (!user) {
    return;
  }

  updateUserBillingFromSubscription(user, subscription);
  await user.save();
}

async function handleInvoicePaid(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) {
    return;
  }

  const user = await User.findOne({ "billing.stripeCustomerId": customerId }).select("billing");
  if (!user) {
    return;
  }

  const billing = ensureBilling(user);
  if (invoice.billing_reason === "subscription_cycle") {
    billing.usedCredits = 0;
  }
  await user.save();
}

export async function billingWebhookHandler(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") {
    return res.status(400).json({ message: "Missing stripe-signature header" });
  }

  const stripe = getStripeClient();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    return res.status(400).json({ message: "Invalid webhook signature", error });
  }

  const exists = await StripeWebhookEvent.findOne({ stripeEventId: event.id }).select("_id");
  if (exists) {
    return res.json({ received: true, duplicate: true });
  }

  console.log(`[billing:webhook] processing ${event.type} (${event.id})`);
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event);
      break;
    case "customer.subscription.updated":
    case "customer.subscription.created":
      await handleSubscriptionUpdated(event);
      break;
    case "invoice.paid":
      await handleInvoicePaid(event);
      break;
    default:
      console.log(`[billing:webhook] ignored event ${event.type}`);
      break;
  }

  await StripeWebhookEvent.create({
    stripeEventId: event.id,
    type: event.type,
  });

  return res.json({ received: true });
}

export async function recordUsage(req: Request, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const { quantity, sourceEventId } = req.body as { quantity?: number; sourceEventId?: string };
  const usageError = validateUsageRecord(quantity, sourceEventId);
  if (usageError) {
    return badRequest(res, usageError);
  }

  const usage = await reportUsageEvent({
    userId: req.userId,
    quantity: Number(quantity),
    sourceEventId: String(sourceEventId),
  });
  return res.json({ usage });
}

export async function getProductEntitlement(req: Request, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const { productKey } = req.params as { productKey: string };
  const purchase = await Purchase.findOne({
    userId: req.userId,
    productKey,
    status: "paid",
  }).select("productKey status fulfilledAt");

  return res.json({
    productKey,
    hasAccess: Boolean(purchase),
    purchase,
  });
}
