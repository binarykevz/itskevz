import { Api } from "telegram";
import { getTelegramClient } from "./client";
import { chunkTelegramText } from "../utils/text";
import { sleep } from "../utils/async";

export async function sendTyping(peer: any, active = true): Promise<void> {
  try {
    const client = getTelegramClient();

    await client.invoke(
      new Api.messages.SetTyping({
        peer,
        action: active
          ? new Api.SendMessageTypingAction()
          : new Api.SendMessageCancelAction(),
      } as any)
    );
  } catch {
    // Typing indicators are best-effort.
  }
}

export function naturalDelay(text: string): number {
  const base = 650;
  const perCharacter = 18;
  const max = 3800;

  return Math.min(max, Math.max(base, base + text.length * perCharacter));
}

export async function sendText(peer: any, text: string): Promise<void> {
  const chunks = chunkTelegramText(text);

  if (chunks.length === 0) {
    return;
  }

  const client = getTelegramClient();

  for (const chunk of chunks) {
    await client.sendMessage(peer, {
      message: chunk,
    } as any);

    await sleep(180);
  }
}

export function friendlyErrorMessage(isVip: boolean): string {
  const vipMessages = [
    "wait lang love parang nagloko connection ko",
    "sandali muna, may problema dito. try ulit in a bit 😭",
    "hold lang love, medyo may issue ako dito sa connection",
  ];

  const normalMessages = [
    "Hmm, something went wrong on my side. Can you try again in a moment?",
    "Sorry, I hiccuped. Try sending that again?",
    "There was a small technical issue. Please try again.",
  ];

  const messages = isVip ? vipMessages : normalMessages;

  return messages[Math.floor(Math.random() * messages.length)] ?? messages[0]!;
}
