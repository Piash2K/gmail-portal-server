// src/modules/auth/auth.service.ts — Auth business logic

import { UserRole, AccountType } from "@prisma/client";
import { verifyGoogleToken } from "../../config/google";
import { signJwt } from "../../utils/token.util";
import { AppError } from "../../utils/response.util";
import prisma from "../../config/database";
import { otpsService } from "../otps/otps.service";

export class AuthService {
  /**
   * PRIMARY LOGIN FLOW — called from the home page "Sign in with Google".
   *
   * Rules:
   *  1. Verify the Google access token to get the real email/googleId.
   *  2. Upsert the User row (one row per real person, keyed by googleId).
   *  3. Upsert a GmailAccount (accountType = PRIMARY) for this user.
   *  4. Issue and return a backend JWT tied to that user's id.
   *
   * Isolation: every subsequent API call uses this JWT, so a user can
   * ONLY ever access their own accounts (userId-scoped queries).
   */
  async loginWithGoogle(
    accessToken: string,
    refreshToken?: string
  ): Promise<{ token: string; user: object; isNew: boolean }> {
    // ── 1. Verify the Google token ──
    let googleUser;
    try {
      googleUser = await verifyGoogleToken(accessToken);
    } catch (err: any) {
      console.error("[Auth] Google token verification failed:", err?.message ?? err);
      throw new AppError("Invalid or expired Google access token. Please sign in again.", 401);
    }

    if (!googleUser.id || !googleUser.email) {
      throw new AppError("Could not retrieve user info from Google.", 400);
    }

    // ── 2. Upsert the User row ──
    const existingUser = await prisma.user.findUnique({
      where: { googleId: googleUser.id },
    });

    const user = await prisma.user.upsert({
      where: { googleId: googleUser.id },
      update: {
        name: googleUser.name ?? "Unknown",
        picture: googleUser.picture ?? null,
        // Keep email in sync in case they changed their Google display name
        email: googleUser.email,
      },
      create: {
        googleId: googleUser.id,
        email: googleUser.email,
        name: googleUser.name ?? "Unknown",
        picture: googleUser.picture ?? null,
        role: UserRole.USER,
      },
    });

    // ── 3. Upsert the PRIMARY GmailAccount for this user ──
    // If this email was previously added as SECONDARY by another user's mistake,
    // we still allow the owner to log in as primary — the ownership is determined
    // by googleId (which maps 1:1 to the real person), not email.
    let primaryAccount;
    try {
      primaryAccount = await prisma.gmailAccount.upsert({
        where: { userId_email: { userId: user.id, email: googleUser.email } },
        update: {
          accessToken,
          ...(refreshToken ? { refreshToken } : {}),
          status: "ACTIVE",
          accountType: AccountType.PRIMARY,
          name: googleUser.name ?? "Unknown",
          picture: googleUser.picture ?? null,
        },
        create: {
          userId: user.id,
          email: googleUser.email,
          name: googleUser.name ?? "Unknown",
          picture: googleUser.picture ?? null,
          accessToken,
          refreshToken: refreshToken ?? null,
          status: "ACTIVE",
          accountType: AccountType.PRIMARY,
        },
      });

      // Kick off async OTP fetch for the primary inbox
      otpsService.refreshAccount(user.id, primaryAccount.id).catch((err) => {
        console.warn("[Auth] Async OTP fetch warning for primary account:", err?.message ?? err);
      });
    } catch (err) {
      console.error("[Auth] Failed to upsert primary GmailAccount:", err);
      throw err;
    }

    // ── 4. Issue backend JWT ──
    const token = signJwt({ userId: user.id, email: user.email });
    return { token, user, isNew: !existingUser };
  }

  // Get user profile by id
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        role: true,
        createdAt: true,
        _count: { select: { accounts: true } },
      },
    });

    if (!user) throw new AppError("User not found.", 404);
    return user;
  }
}

export const authService = new AuthService();
