// src/app.ts — Express application setup

import "express-async-errors";
import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";

// Module routers
import authRouter from "./modules/auth/auth.router";
import accountsRouter from "./modules/accounts/accounts.router";
import otpsRouter from "./modules/otps/otps.router";
import workflowRouter from "./modules/workflow/workflow.router";

// Global error handler (must be last)
import { errorMiddleware } from "./middleware/error.middleware";

const app: Application = express();

// Security & Parsing
app.use(helmet());
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "gmail-portal-server",
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/otps", otpsRouter);
app.use("/api/workflow", workflowRouter);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route not found. Available: /api/auth, /api/accounts, /api/otps, /api/workflow`,
  });
});

// Global Error Middleware
app.use(errorMiddleware);

export default app;
