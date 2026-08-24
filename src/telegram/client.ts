import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { env } from "../config/env";

let client: TelegramClient | null = null;

export async function initTelegram(): Promise<TelegramClient> {
  if (!env.TELEGRAM_SESSION) {
    throw new Error(
      "TELEGRAM_SESSION is empty. Run `bun run login` to generate a session string."
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

  return client;
}

export function getTelegramClient(): TelegramClient {
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
