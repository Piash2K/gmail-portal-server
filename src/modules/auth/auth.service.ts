// src/modules/auth/auth.service.ts — Auth business logic

import { verifyGoogleToken } from "../../config/google";
import { signJwt } from "../../utils/token.util";
import { AppError } from "../../utils/response.util";
import prisma from "../../config/database";

export class AuthService {
  // Exchange Google access token → upsert user → return JWT
  async loginWithGoogle(
    accessToken: string,
    refreshToken?: string
  ): Promise<{ token: string; user: object; isNew: boolean }> {
    const googleUser = await verifyGoogleToken(accessToken);

    if (!googleUser.id || !googleUser.email) {
      throw new AppError("Could not retrieve user info from Google.", 400);
    }

    const existingUser = await prisma.user.findUnique({
      where: { googleId: googleUser.id },
    });

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
      },
    });

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
        createdAt: true,
        _count: { select: { accounts: true } },
      },
    });

    if (!user) throw new AppError("User not found.", 404);
    return user;
  }
}

export const authService = new AuthService();
