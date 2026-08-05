// src/middleware/validate.middleware.ts — Zod request validation

import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { sendError } from "../utils/response.util";

type RequestPart = "body" | "query" | "params";

export function validate(schema: ZodSchema, part: RequestPart = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      sendError(
        res,
        "Validation failed.",
        422,
        result.error.flatten().fieldErrors
      );
      return;
    }

    // Replace request part with parsed/coerced data
    req[part] = result.data;
    next();
  };
}
