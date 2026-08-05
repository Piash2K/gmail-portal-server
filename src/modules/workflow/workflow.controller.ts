// src/modules/workflow/workflow.controller.ts — Workflow HTTP handlers

import { Response, NextFunction } from "express";
import { AuthRequest } from "../../types";
import { workflowService } from "./workflow.service";
import { sendSuccess, sendCreated } from "../../utils/response.util";

export class WorkflowController {
  // GET /api/workflow
  async getSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await workflowService.getActiveSession(req.user!.id);
      if (!data) {
        sendSuccess(res, null, "No active workflow session. Create one to get started.");
        return;
      }
      sendSuccess(res, data, "Workflow session retrieved.");
    } catch (err) { next(err); }
  }

  // POST /api/workflow
  async createSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.body as { name?: string };
      const data = await workflowService.createSession(req.user!.id, name);
      sendCreated(res, data, "Workflow session created.");
    } catch (err) { next(err); }
  }

  // GET /api/workflow/progress
  async getProgress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const progress = await workflowService.getProgress(req.user!.id);
      sendSuccess(res, progress, "Progress retrieved.");
    } catch (err) { next(err); }
  }

  // PATCH /api/workflow/items/:accountId/done
  async markDone(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const accountId = req.params.accountId as string;
      const item = await workflowService.markDone(req.user!.id, accountId);
      sendSuccess(res, item, "Account marked as done.");
    } catch (err) { next(err); }
  }

  // PATCH /api/workflow/items/:accountId/skip
  async markSkipped(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const accountId = req.params.accountId as string;
      const item = await workflowService.markSkipped(req.user!.id, accountId);
      sendSuccess(res, item, "Account skipped.");
    } catch (err) { next(err); }
  }

  // POST /api/workflow/reset
  async reset(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await workflowService.resetSession(req.user!.id);
      sendSuccess(res, data, "Workflow reset. All items are now pending.");
    } catch (err) { next(err); }
  }
}

export const workflowController = new WorkflowController();
