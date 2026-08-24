import { env, analysisModel } from "../config/env";
import { logger } from "../utils/logger";
import { KeyMutex, sleep } from "../utils/async";
import { cleanAssistantText } from "../utils/text";
import { detectLanguage } from "../utils/language";
import { SlidingWindowRateLimiter } from "../utils/rate-limit";

import { ensureUser, isVip, getVipProfile } from "../vip/vip";
import { getPersonalityProfile } from "../vip/profiles";

import {
  getRecentMessages,
  formatRecentForPrompt,
  saveConversation,
} from "../storage/conversations";

import { GeminiClient, type GeminiPart } from "../ai/gemini";
import { buildSystemPrompt } from "../ai/prompts";
import { detectMood, persistMood } from "../ai/mood";
import { extractMemories } from "../ai/memory";
import { maybeLearnPersonality } from "../ai/personality";

import {
  sendText,
  sendTyping,
  naturalDelay,
  friendlyErrorMessage,
} from "../telegram/messages";

import {
  processIncomingMedia,
  maybeHandleMediaRequest,
} from "../media/processor";

const gemini = new GeminiClient(
  env.GEMINI_API_KEY ?? "",
  env.GEMINI_MODEL,
  analysisModel
);

const mutex = new KeyMutex();
const rateLimiter = new SlidingWindowRateLimiter();

export async function handleIncomingMessage(event: any): Promise<void> {
  const fallbackPeer = event?.inputChat ?? event?.senderId;

  try {
    await mutex.run(String(event?.senderId ?? "unknown"), async () => {
      await processMessage(event);
    });
  } catch (error) {
    logger.error({ err: error }, "Failed handling incoming Telegram message");

    try {
      await sendText(fallbackPeer, friendlyErrorMessage(false));
    } catch {
      // ignore
    }
  }
}

async function processMessage(event: any): Promise<void> {
  const message = event.message;

  if (!message) return;

  const userId = String(event.senderId ?? message.senderId ?? "");

  if (!userId) return;

  const peer = event.inputChat ?? event.senderId ?? userId;

  const sender = event.sender ?? {};

  await ensureUser(userId, {
    firstName: sender.firstName,
    lastName: sender.lastName,
    username: sender.username,
  });

  const vip = await isVip(userId);

  const limit = vip
    ? env.RATE_LIMIT_VIP_PER_MIN
    : env.RATE_LIMIT_NORMAL_PER_MIN;

  if (!rateLimiter.allow(`messages:${userId}`, limit)) {
    await sendText(
      peer,
      vip
        ? "hinay-hinay muna love 😭 ang bilis mo mag-message"
        : "Give me a second, you're sending messages too quickly."
    );

    return;
  }

  const text = typeof message.message === "string" ? message.message.trim() : "";

  const recentRows = await getRecentMessages(userId, vip ? 35 : 12);

  const media = await processIncomingMedia(message, userId);

  const currentText =
    text ||
    media.contextualNote ||
    "";

  if (!currentText && media.geminiParts.length === 0) {
    return;
  }

  if (
    text &&
    (await maybeHandleMediaRequest(peer, userId, text, vip))
  ) {
    await saveConversation({
      userId,
      role: "user",
      content: text,
      mediaType: media.mediaType,
      mediaId: media.mediaId,
    });

    await saveConversation({
      userId,
      role: "assistant",
      content: "[sent stored media]",
    });

    return;
  }

  const language = detectLanguage(currentText);

  const mood = vip
    ? detectMood(currentText)
    : {
        mood: "neutral" as const,
        confidence: 0.4,
        reason: "Non-VIP mood detection disabled",
      };

  if (vip) {
    await persistMood(userId, mood);
  }

  const memories = vip
    ? await (
        await import("../ai/memory")
      ).getRelevantMemories(userId, 8)
    : [];

  const vipProfile = vip ? await getVipProfile(userId) : null;
  const personality = vip ? await getPersonalityProfile(userId) : null;

  const systemPrompt = buildSystemPrompt({
    isVip: vip,
    currentText,
    recentConversation: formatRecentForPrompt(recentRows),
    memories,
    mood,
    language,
    personality,
    vipProfile,
    mediaNote: media.contextualNote,
  });

  const parts: GeminiPart[] = [
    ...media.geminiParts,
    {
      text:
        currentText ||
        "The user sent media without text. Respond naturally to the attached media.",
    },
  ];

  await sendTyping(peer, true);

  let reply = "";

  try {
    reply = cleanAssistantText(
      await gemini.generate({
        system: systemPrompt,
        parts,
        temperature: vip ? 0.9 : 0.65,
        maxOutputTokens: 700,
      })
    );
  } catch (error) {
    logger.error({ err: error }, "Gemini generation failed");
    reply = friendlyErrorMessage(vip);
  }

  if (!reply) {
    reply = friendlyErrorMessage(vip);
  }

  await sleep(naturalDelay(reply));

  await sendText(peer, reply);

  await saveConversation({
    userId,
    role: "user",
    content: currentText,
    mediaType: media.mediaType,
    mediaId: media.mediaId,
  });

  await saveConversation({
    userId,
    role: "assistant",
    content: reply,
  });

  if (vip) {
    void extractMemories(gemini, userId, currentText, reply).catch((error) => {
      logger.warn({ err: error }, "Memory extraction failed");
    });

    void maybeLearnPersonality(gemini, userId, vip).catch((error) => {
      logger.warn({ err: error }, "Personality learning failed");
    });
  }
}
