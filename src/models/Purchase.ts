import { Schema, Types, model } from "mongoose";

export interface IPurchase {
  userId: Types.ObjectId;
  productKey: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId?: string;
  stripeInvoiceId?: string;
  priceId: string;
  amountTotal: number;
  currency: string;
  status: "pending" | "paid" | "failed";
  fulfilledAt?: Date;
}

const purchaseSchema = new Schema<IPurchase>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    productKey: { type: String, required: true, index: true },
    stripeCheckoutSessionId: { type: String, required: true, unique: true, index: true },
    stripePaymentIntentId: { type: String },
    stripeInvoiceId: { type: String },
    priceId: { type: String, required: true },
    amountTotal: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
      required: true,
    },
    fulfilledAt: { type: Date },
  },
  { timestamps: true }
);

purchaseSchema.index({ userId: 1, productKey: 1, status: 1 });

const Purchase = model<IPurchase>("Purchase", purchaseSchema);

export default Purchase;
