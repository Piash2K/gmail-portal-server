// src/modules/accounts/accounts.service.ts — Accounts business logic

import { AccountStatus } from "@prisma/client";
import prisma from "../../config/database";
import { AppError } from "../../utils/response.util";
import { verifyGoogleToken } from "../../config/google";

export class AccountsService {
  // List all Gmail accounts for a user
  async listAccounts(userId: string) {
    return prisma.gmailAccount.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        status: true,
        note: true,
        tokenExpiry: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { otpEntries: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  // Add or update (upsert) a Gmail account by verifying its Google token
  async addAccount(
    userId: string,
    accessToken: string,
    refreshToken?: string
  ) {
    // Verify token and get email info
    const googleUser = await verifyGoogleToken(accessToken);

    if (!googleUser.email) {
      throw new AppError("Could not get email from Google token.", 400);
    }

    // Estimate token expiry (1 hour from now by default)
    const tokenExpiry = new Date(Date.now() + 3600 * 1000);

    const account = await prisma.gmailAccount.upsert({
      where: { userId_email: { userId, email: googleUser.email } },
      update: {
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
        tokenExpiry,
        status: AccountStatus.ACTIVE,
        name: googleUser.name ?? "Unknown",
        picture: googleUser.picture ?? null,
      },
      create: {
        userId,
        email: googleUser.email,
        name: googleUser.name ?? "Unknown",
        picture: googleUser.picture ?? null,
        accessToken,
        refreshToken: refreshToken ?? null,
        tokenExpiry,
        status: AccountStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        status: true,
        note: true,
        createdAt: true,
      },
    });

    return account;
  }

  // Get a single account (must belong to user)
  async getAccount(userId: string, accountId: string) {
    const account = await prisma.gmailAccount.findFirst({
      where: { id: accountId, userId },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        status: true,
        note: true,
        tokenExpiry: true,
        createdAt: true,
        _count: { select: { otpEntries: true } },
      },
    });

    if (!account) throw new AppError("Account not found.", 404);
    return account;
  }

  // Delete a Gmail account
  async deleteAccount(userId: string, accountId: string): Promise<void> {
    const account = await prisma.gmailAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new AppError("Account not found.", 404);

    await prisma.gmailAccount.delete({ where: { id: accountId } });
  }

  // Update account status
  async updateStatus(
    userId: string,
    accountId: string,
    status: AccountStatus
  ) {
    const account = await prisma.gmailAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new AppError("Account not found.", 404);

    return prisma.gmailAccount.update({
      where: { id: accountId },
      data: { status },
      select: { id: true, email: true, status: true, note: true },
    });
  }

  // Update or add note for account
  async updateNote(userId: string, accountId: string, note: string) {
    const account = await prisma.gmailAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new AppError("Account not found.", 404);

    return prisma.gmailAccount.update({
      where: { id: accountId },
      data: { note },
      select: { id: true, email: true, note: true },
    });
  }

  // Delete note for account
  async deleteNote(userId: string, accountId: string) {
    const account = await prisma.gmailAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new AppError("Account not found.", 404);

    return prisma.gmailAccount.update({
      where: { id: accountId },
      data: { note: null },
      select: { id: true, email: true, note: true },
    });
  }
}

export const accountsService = new AccountsService();
