import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: Number(process.env.PORT ?? 5000),
  MONGODB_URI:
    process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/mern_auth_starter",
  JWT_SECRET: process.env.JWT_SECRET ?? "change_this_secret",
  CLIENT_URL: process.env.CLIENT_URL ?? "http://localhost:5173",
  CLIENT_APP_URL: process.env.CLIENT_APP_URL ?? process.env.CLIENT_URL ?? "http://localhost:5173",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  STRIPE_PRICE_STARTER_MONTHLY: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
  STRIPE_PRICE_STARTER_YEARLY: process.env.STRIPE_PRICE_STARTER_YEARLY ?? "",
  STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
  STRIPE_PRICE_PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY ?? "",
  STRIPE_PRICE_ENTERPRISE_MONTHLY: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? "",
  STRIPE_PRICE_ENTERPRISE_YEARLY: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY ?? "",
  STRIPE_CREDIT_OVERAGE_PRICE: process.env.STRIPE_CREDIT_OVERAGE_PRICE ?? "",
  STRIPE_CREDIT_USAGE_METER_EVENT: process.env.STRIPE_CREDIT_USAGE_METER_EVENT ?? "credits_used",
  STRIPE_ONE_TIME_PREMIUM_TEMPLATE_PRICE:
    process.env.STRIPE_ONE_TIME_PREMIUM_TEMPLATE_PRICE ?? "",
};
