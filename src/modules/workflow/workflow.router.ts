// src/modules/workflow/workflow.router.ts — Workflow routes

import { Router } from "express";
import { z } from "zod";
import { workflowController } from "./workflow.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";

const router = Router();

router.use(authMiddleware);

const createSessionSchema = z.object({
  name: z.string().optional(),
});

// GET  /api/workflow              — get active session
router.get("/", (req, res, next) => workflowController.getSession(req, res, next));

// POST /api/workflow              — create new session
router.post(
  "/",
  validate(createSessionSchema),
  (req, res, next) => workflowController.createSession(req, res, next)
);

// GET  /api/workflow/progress     — get progress stats
router.get("/progress", (req, res, next) => workflowController.getProgress(req, res, next));

// POST /api/workflow/reset        — reset all items to PENDING
router.post("/reset", (req, res, next) => workflowController.reset(req, res, next));

// PATCH /api/workflow/items/:accountId/done
router.patch("/items/:accountId/done", (req, res, next) =>
  workflowController.markDone(req, res, next)
);

// PATCH /api/workflow/items/:accountId/skip
router.patch("/items/:accountId/skip", (req, res, next) =>
  workflowController.markSkipped(req, res, next)
);

export default router;
