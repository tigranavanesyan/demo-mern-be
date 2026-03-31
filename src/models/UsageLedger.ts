import { Schema, Types, model } from "mongoose";

export interface IUsageLedger {
  userId: Types.ObjectId;
  metric: string;
  quantity: number;
  sourceEventId: string;
  stripeMeterEventId?: string;
  status: "pending" | "sent" | "failed";
}

const usageLedgerSchema = new Schema<IUsageLedger>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    metric: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    sourceEventId: { type: String, required: true, unique: true, index: true },
    stripeMeterEventId: { type: String },
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
      required: true,
    },
  },
  { timestamps: true }
);

const UsageLedger = model<IUsageLedger>("UsageLedger", usageLedgerSchema);

export default UsageLedger;
