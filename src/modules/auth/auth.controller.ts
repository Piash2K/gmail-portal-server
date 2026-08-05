// src/modules/auth/auth.controller.ts — Auth HTTP handlers

import { Response, NextFunction } from "express";
import { AuthRequest } from "../../types";
import { authService } from "./auth.service";
import { sendSuccess } from "../../utils/response.util";

export class AuthController {
  // POST /api/auth/google
  async loginWithGoogle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accessToken, refreshToken } = req.body as {
        accessToken: string;
        refreshToken?: string;
      };
      const result = await authService.loginWithGoogle(accessToken, refreshToken);
      sendSuccess(
        res,
        result,
        result.isNew ? "Account created successfully." : "Signed in successfully.",
        result.isNew ? 201 : 200
      );
    } catch (err) {
      next(err);
    }
  }

  // GET /api/auth/me
  async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await authService.getProfile(req.user!.id);
      sendSuccess(res, profile, "Profile retrieved.");
    } catch (err) {
      next(err);
    }
  }

  // POST /api/auth/logout
  logout(_req: AuthRequest, res: Response): void {
    // JWT is stateless — client should discard the token
    sendSuccess(res, null, "Logged out successfully.");
  }
}

export const authController = new AuthController();
