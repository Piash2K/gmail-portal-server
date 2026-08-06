// src/modules/workflow/workflow.service.ts — Workflow business logic

import { WorkflowAction } from "@prisma/client";
import prisma from "../../config/database";
import { AppError } from "../../utils/response.util";

export class WorkflowService {
  // Get active workflow session for user (includes all items, auto-syncing any new accounts)
  async getActiveSession(userId: string) {
    try {
      let session = await prisma.workflowSession.findFirst({
        where: { userId, isActive: true },
        include: {
          items: {
            include: {
              account: {
                select: { id: true, email: true, name: true, status: true, picture: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!session) return null;
      const currentSessionId = session.id;

      // Ensure all user accounts have workflow items in active session
      const userAccounts = await prisma.gmailAccount.findMany({
        where: { userId },
        select: { id: true },
      });

      const existingAccountIds = new Set((session.items || []).map((i) => i.accountId));
      const missingAccounts = userAccounts.filter((a) => !existingAccountIds.has(a.id));

      if (missingAccounts.length > 0) {
        try {
          await prisma.workflowItem.createMany({
            data: missingAccounts.map((acc) => ({
              sessionId: currentSessionId,
              accountId: acc.id,
              action: WorkflowAction.PENDING,
            })),
            skipDuplicates: true,
          });

          // Refetch session after adding missing items
          const reFetched = await prisma.workflowSession.findFirst({
            where: { id: currentSessionId },
            include: {
              items: {
                include: {
                  account: {
                    select: { id: true, email: true, name: true, status: true, picture: true },
                  },
                },
                orderBy: { createdAt: "asc" },
              },
            },
          });
          if (reFetched) session = reFetched;
        } catch (syncErr) {
          console.warn("[WorkflowService] Workflow item sync warning:", syncErr);
        }
      }

      const progress = this.computeProgress(session.items || []);
      return { session, progress };
    } catch (err) {
      console.error("[WorkflowService] getActiveSession error:", err);
      return null;
    }
  }

  // Create a new workflow session (deactivates any previous one)
  async createSession(userId: string, name?: string) {
    // Deactivate existing sessions
    await prisma.workflowSession.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    // Get all user's accounts to pre-populate items
    const accounts = await prisma.gmailAccount.findMany({
      where: { userId },
      select: { id: true },
    });

    if (accounts.length === 0) {
      throw new AppError("No Gmail accounts found. Add an account first.", 400);
    }

    const session = await prisma.workflowSession.create({
      data: {
        userId,
        name: name ?? `Session ${new Date().toLocaleDateString()}`,
        isActive: true,
        items: {
          create: accounts.map((acc) => ({
            accountId: acc.id,
            action: WorkflowAction.PENDING,
          })),
        },
      },
      include: {
        items: {
          include: {
            account: {
              select: { id: true, email: true, name: true, status: true },
            },
          },
        },
      },
    });

    return { session, progress: this.computeProgress(session.items) };
  }

  // Get progress stats for the active session
  async getProgress(userId: string) {
    const session = await prisma.workflowSession.findFirst({
      where: { userId, isActive: true },
      include: { items: { select: { action: true } } },
    });

    if (!session) throw new AppError("No active workflow session found.", 404);
    return this.computeProgress(session.items);
  }

  // Mark an account as DONE
  async markDone(userId: string, accountId: string) {
    return this.updateItemAction(userId, accountId, WorkflowAction.DONE);
  }

  // Mark an account as SKIPPED
  async markSkipped(userId: string, accountId: string) {
    return this.updateItemAction(userId, accountId, WorkflowAction.SKIPPED);
  }

  // Reset all items in active session to PENDING
  async resetSession(userId: string) {
    const session = await prisma.workflowSession.findFirst({
      where: { userId, isActive: true },
    });
    if (!session) throw new AppError("No active workflow session found.", 404);

    await prisma.workflowItem.updateMany({
      where: { sessionId: session.id },
      data: { action: WorkflowAction.PENDING, completedAt: null },
    });

    return this.getActiveSession(userId);
  }

  // Private helpers

  private async updateItemAction(
    userId: string,
    accountId: string,
    action: WorkflowAction
  ) {
    let session = await prisma.workflowSession.findFirst({
      where: { userId, isActive: true },
    });
    
    if (!session) {
      const sessionRes = await this.createSession(userId);
      session = sessionRes.session;
    }

    let item = await prisma.workflowItem.findUnique({
      where: { sessionId_accountId: { sessionId: session.id, accountId } },
    });

    if (!item) {
      item = await prisma.workflowItem.create({
        data: {
          sessionId: session.id,
          accountId,
          action: WorkflowAction.PENDING,
        },
      });
    }

    const updated = await prisma.workflowItem.update({
      where: { id: item.id },
      data: {
        action,
        completedAt: action !== WorkflowAction.PENDING ? new Date() : null,
      },
      include: {
        account: { select: { id: true, email: true } },
      },
    });

    return updated;
  }

  private computeProgress(items: Array<{ action: WorkflowAction }>) {
    const total = items.length;
    const done = items.filter((i) => i.action === WorkflowAction.DONE).length;
    const skipped = items.filter((i) => i.action === WorkflowAction.SKIPPED).length;
    const pending = items.filter((i) => i.action === WorkflowAction.PENDING).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, skipped, pending, percentComplete: pct };
  }
}

export const workflowService = new WorkflowService();
