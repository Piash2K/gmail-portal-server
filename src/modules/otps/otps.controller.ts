// src/modules/otps/otps.controller.ts — OTP HTTP handlers

import { Response, NextFunction } from "express";
import { AuthRequest } from "../../types";
import { otpsService } from "./otps.service";
import { sendSuccess } from "../../utils/response.util";

export class OtpsController {
  // GET /api/otps
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await otpsService.getAllOtps(req.user!.id);
      sendSuccess(res, data, "OTPs retrieved.");
    } catch (err) { next(err); }
  }

  // GET /api/otps/:accountId
  async getByAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const accountId = req.params.accountId as string;
      const data = await otpsService.getOtpsByAccount(req.user!.id, accountId);
      sendSuccess(res, data, "OTPs retrieved.");
    } catch (err) { next(err); }
  }

  // POST /api/otps/refresh/:accountId
  async refreshAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const accountId = req.params.accountId as string;
      const otps = await otpsService.refreshAccount(req.user!.id, accountId);
      sendSuccess(res, { otps, count: otps.length }, `Fetched ${otps.length} OTP(s) from Gmail.`);
    } catch (err) { next(err); }
  }

  // POST /api/otps/refresh-all
  async refreshAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const results = await otpsService.refreshAll(req.user!.id);
      const successCount = results.filter((r: { error: unknown }) => !r.error).length;
      sendSuccess(
        res,
        results,
        `Refreshed ${successCount}/${results.length} account(s).`
      );
    } catch (err) { next(err); }
  }
}

export const otpsController = new OtpsController();
