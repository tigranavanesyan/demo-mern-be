import { Schema, model } from "mongoose";

export interface IStripeWebhookEvent {
  stripeEventId: string;
  type: string;
  processedAt: Date;
}

const stripeWebhookEventSchema = new Schema<IStripeWebhookEvent>(
  {
    stripeEventId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true },
    processedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

const StripeWebhookEvent = model<IStripeWebhookEvent>(
  "StripeWebhookEvent",
  stripeWebhookEventSchema
);

export default StripeWebhookEvent;
