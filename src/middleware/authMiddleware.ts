import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

type JwtPayload = {
  userId: string;
};

export function protect(req: Request, res: Response, next: NextFunction) {
  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (!token) {
    return res.status(401).json({ message: "Not authorized" });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.userId = decoded.userId;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
