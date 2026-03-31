import bcrypt from "bcryptjs";
import { HydratedDocument, Model, Schema, model } from "mongoose";

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: "user" | "admin";
  billing?: {
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

interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

type UserModel = Model<IUser, object, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    billing: {
      stripeCustomerId: { type: String, index: true },
      subscriptionId: { type: String },
      subscriptionItemId: { type: String },
      subscriptionStatus: { type: String, default: "inactive" },
      subscriptionPriceId: { type: String },
      currentPeriodEnd: { type: Date },
      includedCredits: { type: Number, default: 0 },
      usedCredits: { type: Number, default: 0 },
      creditBalance: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

userSchema.pre(
  "save",
  async function hashPassword(this: HydratedDocument<IUser>) {
    if (!this.isModified("password")) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
);

userSchema.methods.comparePassword = async function comparePassword(password) {
  return bcrypt.compare(password, this.password);
};

const User = model<IUser, UserModel>("User", userSchema);

export default User;
