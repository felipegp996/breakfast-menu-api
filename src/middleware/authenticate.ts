import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { User } from "../models/user";

export async function authenticate(request: Request, response: Response, next: NextFunction) {
  const [scheme, token] = request.headers.authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      response.status(401).json({ error: "Invalid session." });
      return;
    }

    const user = await User.findById(payload.sub).select("role isActive");
    if (!user?.isActive) {
      response.status(401).json({ error: "Account is unavailable." });
      return;
    }

    request.auth = { userId: user.id, role: user.role };
    next();
  } catch {
    response.status(401).json({ error: "Invalid or expired session." });
  }
}

export function requireAdmin(request: Request, response: Response, next: NextFunction) {
  if (request.auth?.role !== "admin") {
    response.status(403).json({ error: "Administrator access required." });
    return;
  }

  next();
}