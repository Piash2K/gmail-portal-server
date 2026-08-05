// src/modules/otps/otps.service.ts — OTP business logic

import prisma from "../../config/database";
import { fetchOtpsFromGmail } from "../../utils/gmail.util";
import { AppError } from "../../utils/response.util";

export class OtpsService {
  // Get latest 5 OTPs for all accounts belonging to this user
  // userId isolation: returns ONLY this user's own accounts
  async getAllOtps(userId: string) {
    const accounts = await prisma.gmailAccount.findMany({
      where: { userId },
      select: { id: true, email: true, name: true, status: true, picture: true, note: true, accountType: true },
      orderBy: [{ accountType: "asc" }, { createdAt: "asc" }],
    });

    const results = await Promise.all(
      accounts.map(async (acc) => {
        // Retrieve latest 5 OTPs directly from database
        const otps = await prisma.otpEntry.findMany({
          where: { accountId: acc.id },
          orderBy: { receivedAt: "desc" },
          take: 5,
        });

        const now = new Date();
        const enriched = otps.map((otp) => ({
          ...otp,
          isNew: (now.getTime() - otp.receivedAt.getTime()) / 60000 < 10,
        }));

        return { account: acc, otps: enriched };
      })
    );

    return results;
  }

  // Get cached latest 5 OTPs for a single account
  async getOtpsByAccount(userId: string, accountId: string) {
    const account = await prisma.gmailAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true, email: true, name: true, status: true, picture: true, note: true },
    });
    if (!account) throw new AppError("Account not found.", 404);

    const otps = await prisma.otpEntry.findMany({
      where: { accountId },
      orderBy: { receivedAt: "desc" },
      take: 5,
    });

    const now = new Date();
    const enriched = otps.map((otp) => ({
      ...otp,
      isNew: (now.getTime() - otp.receivedAt.getTime()) / 60000 < 10,
    }));

    return { account, otps: enriched };
  }

  // Fetch fresh OTPs from Gmail API and upsert into DB
  async refreshAccount(userId: string, accountId: string) {
    const account = await prisma.gmailAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new AppError("Account not found.", 404);

    // Ensure status remains ACTIVE
    await prisma.gmailAccount.update({
      where: { id: accountId },
      data: { status: "ACTIVE", updatedAt: new Date() },
    });

    let parsedOtps: any[] = [];
    try {
      parsedOtps = await fetchOtpsFromGmail(accountId);
    } catch (err) {
      console.warn(`[Gmail API Fetch Warning] ${account.email}:`, err);
      const existing = await prisma.otpEntry.findMany({
        where: { accountId },
        orderBy: { receivedAt: "desc" },
        take: 5,
      });
      const now = new Date();
      return existing.map((otp) => ({
        ...otp,
        isNew: (now.getTime() - otp.receivedAt.getTime()) / 60000 < 10,
      }));
    }

    // Upsert each OTP into Neon database — deduplicate by gmailMsgId
    await Promise.all(
      parsedOtps.map((otp) =>
        prisma.otpEntry.upsert({
          where: { accountId_gmailMsgId: { accountId, gmailMsgId: otp.gmailMsgId } },
          update: {
            otpCode: otp.otpCode,
            sender: otp.sender,
            senderEmail: otp.senderEmail,
            subject: otp.subject,
            snippet: otp.snippet,
            fetchedAt: new Date(),
          },
          create: {
            accountId,
            sender: otp.sender,
            senderEmail: otp.senderEmail,
            otpCode: otp.otpCode,
            subject: otp.subject,
            snippet: otp.snippet,
            gmailMsgId: otp.gmailMsgId,
            receivedAt: otp.receivedAt,
          },
        })
      )
    );

    const latestFive = await prisma.otpEntry.findMany({
      where: { accountId },
      orderBy: { receivedAt: "desc" },
      take: 5,
    });

    const now = new Date();
    return latestFive.map((otp) => ({
      ...otp,
      isNew: (now.getTime() - otp.receivedAt.getTime()) / 60000 < 10,
    }));
  }

  // Refresh OTPs for ALL user accounts (runs in parallel)
  async refreshAll(userId: string) {
    const accounts = await prisma.gmailAccount.findMany({
      where: { userId },
      select: { id: true, email: true },
    });

    const results = await Promise.allSettled(
      accounts.map(async (acc) => {
        try {
          const otps = await this.refreshAccount(userId, acc.id);
          return { accountId: acc.id, email: acc.email, otps, error: null };
        } catch (err) {
          console.warn(`[Refresh Warning] Account ${acc.email}:`, err);
          return {
            accountId: acc.id,
            email: acc.email,
            otps: [],
            error: err instanceof Error ? err.message : "Warning",
          };
        }
      })
    );

    return results.map((r) => (r.status === "fulfilled" ? r.value : r.reason));
  }
}

export const otpsService = new OtpsService();
