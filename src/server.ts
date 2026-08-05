// src/server.ts — Entry point: connect DB and start HTTP server

import app from "./app";
import { env } from "./config/env";
import prisma from "./config/database";

async function bootstrap() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log("✅ Connected to Neon PostgreSQL database");

    const server = app.listen(env.PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════╗
║         Gmail Portal API Server                  ║
╠══════════════════════════════════════════════════╣
║  Status:  🟢 Running                             ║
║  Port:    ${env.PORT.padEnd(38)}║
║  Env:     ${env.NODE_ENV.padEnd(38)}║
║  URL:     http://localhost:${env.PORT.padEnd(21)}     ║
╠══════════════════════════════════════════════════╣
║  Routes:                                         ║
║  POST  /api/auth/google                          ║
║  GET   /api/auth/me                              ║
║  GET   /api/accounts                             ║
║  POST  /api/accounts                             ║
║  GET   /api/otps                                 ║
║  POST  /api/otps/refresh-all                     ║
║  GET   /api/otps/:accountId                      ║
║  POST  /api/otps/refresh/:accountId              ║
║  GET   /api/workflow                             ║
║  POST  /api/workflow                             ║
║  GET   /api/workflow/progress                    ║
║  PATCH /api/workflow/items/:id/done              ║
║  PATCH /api/workflow/items/:id/skip              ║
║  POST  /api/workflow/reset                       ║
╚══════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n⚠️  ${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log("✅ Database disconnected. Goodbye!");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

bootstrap();
