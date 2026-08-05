// src/modules/accounts/accounts.controller.ts — Accounts HTTP handlers

import { Response, NextFunction } from "express";
import { AuthRequest } from "../../types";
import { accountsService } from "./accounts.service";
import { sendSuccess, sendCreated } from "../../utils/response.util";
import { AccountStatus } from "@prisma/client";

export class AccountsController {
  // GET /api/accounts
  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const accounts = await accountsService.listAccounts(req.user!.id);
      sendSuccess(res, accounts, "Accounts retrieved.", 200, { total: accounts.length });
    } catch (err) { next(err); }
  }

  // POST /api/accounts
  async add(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accessToken, refreshToken } = req.body as {
        accessToken: string;
        refreshToken?: string;
      };
      const account = await accountsService.addAccount(req.user!.id, accessToken, refreshToken);
      sendCreated(res, account, "Gmail account linked successfully.");
    } catch (err) { next(err); }
  }

  // GET /api/accounts/:id
  async getOne(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const account = await accountsService.getAccount(req.user!.id, id);
      sendSuccess(res, account);
    } catch (err) { next(err); }
  }

  // DELETE /api/accounts/:id
  async remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      await accountsService.deleteAccount(req.user!.id, id);
      sendSuccess(res, null, "Account removed successfully.");
    } catch (err) { next(err); }
  }

  // PATCH /api/accounts/:id/status
  async updateStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { status } = req.body as { status: AccountStatus };
      const account = await accountsService.updateStatus(req.user!.id, id, status);
      sendSuccess(res, account, "Status updated.");
    } catch (err) { next(err); }
  }

  // PATCH /api/accounts/:id/note
  async updateNote(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { note } = req.body as { note: string };
      const account = await accountsService.updateNote(req.user!.id, id, note);
      sendSuccess(res, account, "Note updated successfully.");
    } catch (err) { next(err); }
  }

  // DELETE /api/accounts/:id/note
  async deleteNote(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const account = await accountsService.deleteNote(req.user!.id, id);
      sendSuccess(res, account, "Note deleted successfully.");
    } catch (err) { next(err); }
  }
}

export const accountsController = new AccountsController();
