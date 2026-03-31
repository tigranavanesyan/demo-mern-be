import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { formatBillingStatus } from "../services/billingService";
import User from "../models/User";

function getCookieOptions() {
  const isProduction = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function signToken(userId: string) {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: "7d" });
}

function setAuthCookie(res: Response, token: string) {
  res.cookie("token", token, getCookieOptions());
}

export async function register(req: Request, res: Response) {
  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ message: "Email already in use" });
  }

  const user = await User.create({ name, email, password });
  const token = signToken(user._id.toString());
  setAuthCookie(res, token);

  return res.status(201).json({
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      billing: formatBillingStatus(user),
    },
  });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isValidPassword = await user.comparePassword(password);
  if (!isValidPassword) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = signToken(user._id.toString());
  setAuthCookie(res, token);

  return res.json({
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      billing: formatBillingStatus(user),
    },
  });
}

export function logout(_: Request, res: Response) {
  const { httpOnly, sameSite, secure } = getCookieOptions();
  res.clearCookie("token", { httpOnly, sameSite, secure });
  return res.json({ message: "Logged out" });
}

export async function me(req: Request, res: Response) {
  const user = await User.findById(req.userId).select("name email role billing");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.json({
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      billing: formatBillingStatus(user),
    },
  });
}

export function adminInfo(req: Request, res: Response) {
  return res.json({
    message: "Admin access granted",
    role: req.userRole,
  });
}

export async function updateRole(req: Request, res: Response) {
  const { role } = req.body as { role?: "user" | "admin" };

  if (!req.userId) {
    return res.status(401).json({ message: "Not authorized" });
  }

  if (!role || !["user", "admin"].includes(role)) {
    return res.status(400).json({ message: "Role must be either user or admin" });
  }

  const userId = (req.body as { userId?: string }).userId ?? req.userId;
  const user = await User.findById(userId).select("name email role billing");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.role = role;
  await user.save();

  return res.json({
    message: "Role updated successfully",
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      billing: formatBillingStatus(user),
    },
  });
}
