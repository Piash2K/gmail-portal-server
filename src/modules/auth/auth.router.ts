// src/modules/auth/auth.router.ts — Auth routes

import { Router } from "express";
import { z } from "zod";
import { authController } from "./auth.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";

const router = Router();

const googleLoginSchema = z.object({
  accessToken: z.string().min(1, "accessToken is required"),
  refreshToken: z.string().optional(),
});

// POST /api/auth/google — exchange Google token for JWT
router.post(
  "/google",
  validate(googleLoginSchema),
  (req, res, next) => authController.loginWithGoogle(req, res, next)
);

// GET /api/auth/me — get authenticated user profile
router.get(
  "/me",
  authMiddleware,
  (req, res, next) => authController.getProfile(req, res, next)
);

// POST /api/auth/logout
router.post(
  "/logout",
  authMiddleware,
  (req, res) => authController.logout(req, res)
);

export default router;
