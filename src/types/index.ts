// ============================================================
// src/types/index.ts — Server-side shared types
// ============================================================

import { Request } from "express";
import { User } from "@prisma/client";

// Extend Express Request to carry authenticated user
export interface AuthRequest extends Request {
  user?: User;
}

// Standardised API response shape
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Gmail OTP parsed from email body
export interface ParsedOtp {
  sender: string;
  senderEmail: string;
  otpCode: string;
  subject: string;
  snippet: string;
  gmailMsgId: string;
  receivedAt: Date;
}

// Token payload stored inside JWT
export interface JwtPayload {
  userId: string;
  email: string;
}

// Google user info returned by People API
export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}
