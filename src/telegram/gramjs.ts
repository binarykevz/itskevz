// @ts-nocheck
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function loadModule(modulePath: string): any {
  try {
    const mod = require(modulePath);
    return mod?.default ?? mod;
  } catch (error) {
    console.error(`Failed to load module: ${modulePath}`);
    console.error(error);
    return {};
  }
}

const telegram = loadModule("telegram");
const sessions = loadModule("telegram/sessions");
const events = loadModule("telegram/events");

export const TelegramClient =
  telegram.TelegramClient ??
  telegram.default?.TelegramClient;

export const Api =
  telegram.Api ??
  telegram.default?.Api;

export const StringSession =
  sessions.StringSession ??
  sessions.default?.StringSession;

export const NewMessage =
  events.NewMessage ??
  events.default?.NewMessage ??
  telegram.events?.NewMessage ??
  telegram.NewMessage;

if (!TelegramClient) {
  throw new Error("Failed to load TelegramClient from GramJS");
}

if (!Api) {
  throw new Error("Failed to load Api from GramJS");
}

if (!StringSession) {
  throw new Error("Failed to load StringSession from GramJS");
}

if (!NewMessage) {
  throw new Error("Failed to load NewMessage from GramJS");
}
