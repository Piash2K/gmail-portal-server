// src/middleware/error.middleware.ts — Global error handler

import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/response.util";
import { env } from "../config/env";
import { Prisma } from "@prisma/client";

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Operational errors we threw intentionally
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({
        success: false,
        message: "A record with this data already exists.",
        errors: err.meta,
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({
        success: false,
        message: "Record not found.",
      });
      return;
    }
  }

  // Zod validation errors (thrown from validate middleware)
  if (err.name === "ZodError") {
    res.status(422).json({
      success: false,
      message: "Validation failed.",
      errors: JSON.parse(err.message),
    });
    return;
  }

  // Unknown errors — log in dev, hide in prod
  console.error("❌ Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error.",
    ...(env.NODE_ENV === "development" && { stack: err.stack }),
  });
}
