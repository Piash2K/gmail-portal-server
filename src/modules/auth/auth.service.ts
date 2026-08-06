// src/modules/auth/auth.service.ts — Auth business logic

import { UserRole, AccountType } from "@prisma/client";
import { verifyGoogleToken } from "../../config/google";
import { signJwt } from "../../utils/token.util";
import { AppError } from "../../utils/response.util";
import prisma from "../../config/database";
import { otpsService } from "../otps/otps.service";

export class AuthService {
  // Called when a user signs up / logs in from the HOME PAGE
  // Creates a User record (role = USER) and upserts their primary GmailAccount (accountType = PRIMARY)
  // Returns a JWT bound to that User's id
  async loginWithGoogle(
    accessToken: string,
    refreshToken?: string
  ): Promise<{ token: string; user: object; isNew: boolean }> {
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

    const existingUser = await prisma.user.findUnique({
      where: { googleId: googleUser.id },
    });

    // Upsert the User row — one row per real person
    const user = await prisma.user.upsert({
      where: { googleId: googleUser.id },
      update: {
        name: googleUser.name ?? "Unknown",
        picture: googleUser.picture ?? null,
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

    // Upsert the PRIMARY GmailAccount for this user (the inbox they signed up with)
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

      // Trigger async OTP fetch from Gmail for the primary inbox
      otpsService.refreshAccount(user.id, primaryAccount.id).catch((err) => {
        console.warn("[Auth] Async OTP fetch warning for primary account:", err?.message ?? err);
      });
    } catch (err) {
      console.error("[Auth] Failed to upsert primary GmailAccount:", err);
      throw err;
    }

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
