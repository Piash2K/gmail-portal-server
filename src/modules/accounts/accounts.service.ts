// src/modules/accounts/accounts.service.ts — Accounts business logic

import { AccountStatus, AccountType } from "@prisma/client";
import prisma from "../../config/database";
import { AppError } from "../../utils/response.util";
import { verifyGoogleToken } from "../../config/google";
import { otpsService } from "../otps/otps.service";

export class AccountsService {
  // List all accounts belonging to this user ONLY (primary + their secondary accounts)
  // userId is the isolation key — users can NEVER see another user's accounts
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
        accountType: true,
        tokenExpiry: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { otpEntries: true } },
      },
      orderBy: [{ accountType: "asc" }, { createdAt: "asc" }],
    });
  }

  // Called when the logged-in primary user clicks "Add Account" from the dashboard
  // The new email is saved as SECONDARY under the same userId — no new User row created
  async addAccount(
    userId: string,
    accessToken: string,
    refreshToken?: string
  ) {
    const googleUser = await verifyGoogleToken(accessToken);

    if (!googleUser.email) {
      throw new AppError("Could not get email from Google token.", 400);
    }

    // Prevent re-adding the primary account as secondary
    const primaryAccount = await prisma.gmailAccount.findFirst({
      where: { userId, accountType: AccountType.PRIMARY },
    });

    if (primaryAccount && primaryAccount.email === googleUser.email) {
      throw new AppError(
        "This is already your primary account. Use 'Add Account' to add a different email.",
        409
      );
    }

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
        // Secondary type is enforced — cannot be changed back to primary via this route
        accountType: AccountType.SECONDARY,
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
        accountType: AccountType.SECONDARY,
      },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        status: true,
        note: true,
        accountType: true,
        createdAt: true,
      },
    });

    otpsService.refreshAccount(userId, account.id).catch((err) => {
      console.warn("[Accounts] Async OTP fetch warning for added account:", err?.message ?? err);
    });

    return account;
  }

  // Get a single account — must belong to this user
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
        accountType: true,
        tokenExpiry: true,
        createdAt: true,
        _count: { select: { otpEntries: true } },
      },
    });

    if (!account) throw new AppError("Account not found.", 404);
    return account;
  }

  // Delete a Gmail account — must belong to this user
  async deleteAccount(userId: string, accountId: string): Promise<void> {
    const account = await prisma.gmailAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new AppError("Account not found.", 404);

    if (account.accountType === AccountType.PRIMARY) {
      throw new AppError("Cannot delete your primary account.", 400);
    }

    await prisma.gmailAccount.delete({ where: { id: accountId } });
  }

  // Update account status — must belong to this user
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

  // Save/update note for an account in the database
  async updateNote(userId: string, accountId: string, note: string) {
    const account = await prisma.gmailAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new AppError("Account not found.", 404);

    await prisma.accountNote.upsert({
      where: { accountId },
      update: { content: note },
      create: { accountId, userId, content: note },
    });

    return prisma.gmailAccount.update({
      where: { id: accountId },
      data: { note },
      select: { id: true, email: true, note: true },
    });
  }

  // Delete note for an account
  async deleteNote(userId: string, accountId: string) {
    const account = await prisma.gmailAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new AppError("Account not found.", 404);

    await prisma.accountNote.deleteMany({
      where: { accountId, userId },
    });

    return prisma.gmailAccount.update({
      where: { id: accountId },
      data: { note: null },
      select: { id: true, email: true, note: true },
    });
  }
}

export const accountsService = new AccountsService();
