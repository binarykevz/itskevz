import { env } from "./config/env";
import { logger } from "./utils/logger";

import { initDatabase } from "./storage/database";
import { syncEnvVips } from "./vip/vip";

import { initTelegram, shutdownTelegram } from "./telegram/client";
import { registerTelegramEvents } from "./telegram/events";

import { db } from "./storage/database";

async function main(): Promise<void> {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required");
  }

  await initDatabase();
  await syncEnvVips();

  const client = await initTelegram();

  registerTelegramEvents(client);

  logger.info("Kevin is online");
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down");

  try {
    await shutdownTelegram();
  } catch (error) {
    logger.warn({ err: error }, "Telegram shutdown failed");
  }

  try {
    await (db as any).close?.();
  } catch {
    // ignore
  }

  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((error) => {
  logger.fatal({ err: error }, "Fatal startup error");
  process.exit(1);
});
