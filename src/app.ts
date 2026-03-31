import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env";
import authRouter from "./routes/authRoutes";

const app = express();

app.use(
  cors({
    origin: [env.CLIENT_URL, "https://demo-mern-fe.vercel.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);

export default app;
