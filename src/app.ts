import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { billingWebhookHandler } from "./controllers/billingController";
import authRouter from "./routes/authRoutes";
import billingRouter from "./routes/billingRoutes";

const app = express();

app.use(
  cors({
    origin: [env.CLIENT_URL, "https://demo-mern-fe.vercel.app"],
    credentials: true,
  })
);
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), billingWebhookHandler);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/billing", billingRouter);

export default app;
