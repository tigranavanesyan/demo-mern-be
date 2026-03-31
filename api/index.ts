import app from "../src/app";
import { connectDB } from "../src/config/db";

export default async function handler(req: any, res: any) {
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error("Vercel handler DB error", error);
    return res.status(500).json({ message: "Database connection failed" });
  }
}
