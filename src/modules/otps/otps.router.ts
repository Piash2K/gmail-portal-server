// src/modules/otps/otps.router.ts — OTP routes

import { Router } from "express";
import { otpsController } from "./otps.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware);

// GET  /api/otps               — all OTPs across all accounts (cached)
router.get("/", (req, res, next) => otpsController.getAll(req, res, next));

// POST /api/otps/refresh-all   — refresh all accounts from Gmail
router.post("/refresh-all", (req, res, next) => otpsController.refreshAll(req, res, next));

// GET  /api/otps/:accountId    — OTPs for one account
router.get("/:accountId", (req, res, next) => otpsController.getByAccount(req, res, next));

// POST /api/otps/refresh/:accountId — refresh one account from Gmail
router.post("/refresh/:accountId", (req, res, next) =>
  otpsController.refreshAccount(req, res, next)
);

export default router;
