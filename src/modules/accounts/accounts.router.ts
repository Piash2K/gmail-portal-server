// src/modules/accounts/accounts.router.ts — Accounts routes

import { Router } from "express";
import { z } from "zod";
import { accountsController } from "./accounts.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";

const router = Router();

// All account routes require authentication
router.use(authMiddleware);

const addAccountSchema = z.object({
  accessToken: z.string().min(1, "accessToken is required"),
  refreshToken: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["ACTIVE", "IDLE", "ERROR"]),
});

const updateNoteSchema = z.object({
  note: z.string().max(2000, "Note must be under 2000 characters"),
});

router.get("/", (req, res, next) => accountsController.list(req, res, next));

router.post(
  "/",
  validate(addAccountSchema),
  (req, res, next) => accountsController.add(req, res, next)
);

router.get("/:id", (req, res, next) => accountsController.getOne(req, res, next));

router.delete("/:id", (req, res, next) => accountsController.remove(req, res, next));

router.patch(
  "/:id/status",
  validate(updateStatusSchema),
  (req, res, next) => accountsController.updateStatus(req, res, next)
);

router.patch(
  "/:id/note",
  validate(updateNoteSchema),
  (req, res, next) => accountsController.updateNote(req, res, next)
);

router.delete("/:id/note", (req, res, next) => accountsController.deleteNote(req, res, next));

export default router;
