// src/utils/gmail.util.ts — Real Gmail API integration

import { google, gmail_v1 } from "googleapis";
import { createOAuth2Client, refreshAccessToken } from "../config/google";
import { parseOtpFromText, extractSenderName, extractSenderEmail } from "./otp-parser.util";
import { ParsedOtp } from "../types";
import prisma from "../config/database";

// Decode Gmail base64url encoding
function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

// Recursively extract plain text or HTML body from MIME parts
function extractBody(payload: gmail_v1.Schema$MessagePart): string {
  if (!payload) return "";

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    // Prefer plain text
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    // Fallback to HTML (strip tags)
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return decodeBase64Url(part.body.data).replace(/<[^>]+>/g, " ");
      }
    }
    // Recurse into nested parts
    for (const part of payload.parts) {
      const body = extractBody(part);
      if (body) return body;
    }
  }

  return "";
}

// Ensure a GmailAccount has a valid (non-expired) access token.
// Automatically refreshes using refreshToken if expired.
export async function getValidAccessToken(accountId: string): Promise<string> {
  const account = await prisma.gmailAccount.findUniqueOrThrow({
    where: { id: accountId },
  });

  const now = new Date();
  const isExpired = account.tokenExpiry ? account.tokenExpiry <= now : false;

  if (!isExpired) {
    return account.accessToken;
  }

  if (!account.refreshToken) {
    console.warn(`Account ${account.email} token expired and has no refresh token. Using existing accessToken.`);
    return account.accessToken;
  }

  try {
    const { accessToken, expiry } = await refreshAccessToken(account.refreshToken);
    await prisma.gmailAccount.update({
      where: { id: accountId },
      data: { accessToken, tokenExpiry: expiry },
    });
    return accessToken;
  } catch (err) {
    console.warn(`Token refresh failed for ${account.email}, fallback to existing accessToken:`, err);
    return account.accessToken;
  }
}

// Fetch OTP emails from Gmail API for a given account
export async function fetchOtpsFromGmail(accountId: string): Promise<ParsedOtp[]> {
  const accessToken = await getValidAccessToken(accountId);
  const auth = createOAuth2Client(accessToken);
  const gmail = google.gmail({ version: "v1", auth });

  // Targeted Inbox search for recent OTP/verification messages
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: "label:INBOX (OTP OR code OR verification OR verify OR auth OR login OR 2FA OR security OR reset OR passcode)",
    maxResults: 15,
  });

  const messages = listRes.data.messages ?? [];
  if (messages.length === 0) return [];

  // Fetch messages in parallel to drastically improve speed
  const parsedOtpsResults = await Promise.all(
    messages.map(async (msg) => {
      if (!msg.id) return null;

      try {
        const msgRes = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "full",
        });

        const headers = msgRes.data.payload?.headers ?? [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

        const from = getHeader("From");
        const subject = getHeader("Subject");
        const dateStr = getHeader("Date");
        const snippet = msgRes.data.snippet ?? "";
        const body = extractBody(msgRes.data.payload as gmail_v1.Schema$MessagePart);

        // Search full email text (subject + snippet + body)
        const fullText = `${subject} ${snippet} ${body}`;
        const otpCode = parseOtpFromText(fullText);

        if (otpCode) {
          return {
            sender: extractSenderName(from),
            senderEmail: extractSenderEmail(from),
            otpCode,
            subject: subject || "OTP Verification",
            snippet: snippet || body.slice(0, 120),
            gmailMsgId: msg.id,
            receivedAt: dateStr ? new Date(dateStr) : new Date(),
          } as ParsedOtp;
        }
      } catch (err) {
        console.warn(`Error reading message ${msg.id}:`, err);
      }
      return null;
    })
  );

  const parsedOtps = parsedOtpsResults.filter((item): item is ParsedOtp => item !== null);

  // Sort newest first
  return parsedOtps.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
}
