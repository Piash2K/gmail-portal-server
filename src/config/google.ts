// src/config/google.ts — Google OAuth2 client factory

import { google } from "googleapis";
import { env } from "./env";

// Reusable OAuth2 client with app credentials
export function createOAuth2Client(accessToken?: string, refreshToken?: string) {
  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET
  );

  if (accessToken || refreshToken) {
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  return oauth2Client;
}

// Verify a Google access token and return user info
export async function verifyGoogleToken(accessToken: string) {
  const oauth2Client = createOAuth2Client(accessToken);
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return data;
}

// Refresh an expired access token using the refresh token
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiry: Date }> {
  const oauth2Client = createOAuth2Client(undefined, refreshToken);
  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Failed to refresh access token");
  }

  return {
    accessToken: credentials.access_token,
    expiry: new Date(credentials.expiry_date ?? Date.now() + 3600 * 1000),
  };
}
