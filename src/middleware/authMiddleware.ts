import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import User from "../models/User";

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

export function allowRole(roles: Array<"user" | "admin">) {
  return async function roleGuard(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    if (!req.userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const user = await User.findById(req.userId).select("role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.userRole = user.role;
    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
}
