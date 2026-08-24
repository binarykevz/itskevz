import { TelegramClient, StringSession, Api } from "./gramjs";
import { env } from "../config/env";
import { logger } from "../utils/logger";

let client: any = null;

export async function initTelegram(): Promise<any> {
  if (env.TELEGRAM_BOT_TOKEN) {
    logger.info("Starting Kevin in MTProto bot mode");

    client = new TelegramClient(
      new StringSession(""),
      env.TELEGRAM_API_ID,
      env.TELEGRAM_API_HASH,
      {
        connectionRetries: 5,
        deviceModel: "Kevin Companion Bot",
        systemVersion: "Bun",
        appVersion: "1.0.0",
      }
    );

    await client.start({
      botAuthToken: env.TELEGRAM_BOT_TOKEN,
    });

    try {
      await client.invoke(new Api.updates.GetState());
    } catch {
      // Best-effort update state initialization.
    }

    return client;
  }

  logger.info("Starting Kevin in MTProto user-account mode");

  if (!env.TELEGRAM_SESSION) {
    throw new Error(
      "TELEGRAM_SESSION is empty. Use TELEGRAM_BOT_TOKEN for bot mode, or generate a session for user mode."
    );
  }

  const session = new StringSession(env.TELEGRAM_SESSION);

  client = new TelegramClient(session, env.TELEGRAM_API_ID, env.TELEGRAM_API_HASH, {
    connectionRetries: 5,
    deviceModel: "Kevin Companion",
    systemVersion: "Bun",
    appVersion: "1.0.0",
  });

  await client.connect();

  const authorized = await client.isUserAuthorized();

  if (!authorized) {
    throw new Error("Telegram session is not authorized. Generate a new session.");
  }

  try {
    await client.invoke(new Api.updates.GetState());
  } catch {
    // Best-effort update state initialization.
  }

  return client;
}

export function getTelegramClient(): any {
  if (!client) {
    throw new Error("Telegram client has not been initialized");
  }

  return client;
}

export async function shutdownTelegram(): Promise<void> {
  if (!client) return;

  try {
    await client.destroy();
  } finally {
    client = null;
  }
}
