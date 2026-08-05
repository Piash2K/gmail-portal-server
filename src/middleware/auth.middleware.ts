// src/middleware/auth.middleware.ts — JWT authentication guard

import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { extractBearerToken, verifyJwt } from "../utils/token.util";
import { AppError, sendError } from "../utils/response.util";
import prisma from "../config/database";

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      sendError(res, "Authentication required. Please provide a Bearer token.", 401);
      return;
    }

    const payload = verifyJwt(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      sendError(res, "User not found. Please sign in again.", 401);
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) {
      sendError(res, err.message, err.statusCode);
      return;
    }
    sendError(res, "Authentication failed.", 401);
  }
}
