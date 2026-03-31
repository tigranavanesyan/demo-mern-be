import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: Number(process.env.PORT ?? 5000),
  MONGODB_URI:
    process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/mern_auth_starter",
  JWT_SECRET: process.env.JWT_SECRET ?? "change_this_secret",
  CLIENT_URL: process.env.CLIENT_URL ?? "http://localhost:5173",
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
