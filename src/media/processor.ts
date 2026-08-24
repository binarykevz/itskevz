import { env } from "../config/env";
import { logger } from "../utils/logger";
import {
  classifyIncomingMedia,
  type IncomingMediaInfo,
} from "../telegram/media";
import {
  saveTelegramFile,
  searchTelegramFiles,
  type StoredMediaType,
} from "../storage/telegram-files";
import { downloadMessageMediaBuffer } from "./downloader";
import { sendExistingTelegramFile } from "./uploader";
import { sendText } from "../telegram/messages";
import type { GeminiPart } from "../ai/gemini";

export interface ProcessedMediaResult {
  mediaId?: string;
  mediaType?: StoredMediaType;
  geminiParts: GeminiPart[];
  contextualNote?: string;
}

export async function processIncomingMedia(
  message: any,
  userId: string
): Promise<ProcessedMediaResult> {
  try {
    const info: IncomingMediaInfo | null = classifyIncomingMedia(message);

    const caption =
      typeof message?.message === "string" ? message.message.trim() : "";

    if (!info) {
      return {
        geminiParts: [],
      };
    }

    const mediaId = await saveTelegramFile({
      ownerUserId: userId,
      mediaType: info.mediaType,
      telegramFileId: info.telegramFileId,
      telegramAccessHash: info.telegramAccessHash,
      telegramFileReference: info.telegramFileReference,
      fileName: info.fileName,
      mimeType: info.mimeType,
      size: info.size,
      caption,
    });

    const baseNote = [
      `User sent a ${info.mediaType}`,
      info.fileName ? ` named ${info.fileName}` : "",
      caption ? ` with caption: ${caption}` : "",
    ]
      .filter(Boolean)
      .join("");

    const size = info.size ?? 0;
    const smallEnough = size <= env.MAX_INLINE_MEDIA_BYTES;

    const canInlinePhoto = info.mediaType === "photo" && smallEnough;

    const canInlineAudio =
      (info.mediaType === "audio" || info.mediaType === "voice") && smallEnough;

    const canInlineVideo =
      info.mediaType === "video" &&
      smallEnough &&
      Boolean(info.mimeType?.startsWith("video/"));

    const canInlinePdf =
      info.mediaType === "document" &&
      info.mimeType === "application/pdf" &&
      smallEnough;

    if (canInlinePhoto || canInlineAudio || canInlineVideo || canInlinePdf) {
      const buffer = await downloadMessageMediaBuffer(message);

      if (buffer) {
        const mimeType =
          info.mimeType ??
          (info.mediaType === "photo"
            ? "image/jpeg"
            : info.mediaType === "video"
              ? "video/mp4"
              : info.mediaType === "audio"
                ? "audio/mpeg"
                : info.mediaType === "voice"
                  ? "audio/ogg"
                  : "application/octet-stream");

        return {
          mediaId,
          mediaType: info.mediaType,
          geminiParts: [
            {
              inlineData: {
                mimeType,
                data: buffer.toString("base64"),
              },
            },
          ],
          contextualNote: `${baseNote}. The media is attached for analysis.`,
        };
      }
    }

    return {
      mediaId,
      mediaType: info.mediaType,
      geminiParts: [],
      contextualNote: `${baseNote}. The media was not analyzed because it is too large or unsupported.`,
    };
  } catch (error) {
    logger.warn({ err: error }, "Failed to process incoming media");

    return {
      geminiParts: [],
      contextualNote: "User sent media, but metadata processing failed.",
    };
  }
}

function inferRequestedMediaType(text: string): StoredMediaType | undefined {
  const lower = text.toLowerCase();

  if (lower.includes("video")) return "video";
  if (/(photo|pic|picture|foto)/.test(lower)) return "photo";
  if (lower.includes("voice")) return "voice";
  if (lower.includes("audio") || lower.includes("song")) return "audio";
  if (lower.includes("sticker")) return "sticker";
  if (lower.includes("gif") || lower.includes("animation")) return "animation";
  if (/(doc|document|file|pdf)/.test(lower)) return "document";

  return undefined;
}

export async function maybeHandleMediaRequest(
  peer: any,
  userId: string,
  text: string,
  isVip: boolean
): Promise<boolean> {
  if (!text.trim()) return false;

  const lower = text.toLowerCase();

  const retrievalIntent =
    /(send|padala|show|pakita|retrieve|hanap|find|search|yung|yung|nung|kanina|that)\b/.test(
      lower
    );

  const mediaIntent =
    /(photo|pic|picture|foto|video|doc|document|file|audio|voice|sticker|gif|animation)/.test(
      lower
    );

  if (!retrievalIntent || !mediaIntent) {
    return false;
  }

  const inferredType = inferRequestedMediaType(lower);

  const keywords = lower
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 2 &&
        ![
          "send",
          "me",
          "the",
          "that",
          "yung",
          "nung",
          "please",
          "pakisend",
          "padala",
          "mo",
          "ako",
          "ko",
          "file",
          "media",
        ].includes(word)
    )
    .slice(0, 3)
    .join(" ");

  const query = keywords.trim() || "%";
  const files = await searchTelegramFiles(userId, query, 8);

  const candidate =
    files.find((file) => !inferredType || file.mediaType === inferredType) ??
    files[0];

  if (!candidate?.telegramFileId || !candidate.telegramAccessHash) {
    return false;
  }

  try {
    await sendExistingTelegramFile(peer, candidate);

    await sendText(
      peer,
      isVip ? "eto na 'yan 😭" : "Here you go."
    );

    return true;
  } catch (error) {
    logger.warn({ err: error }, "Failed to resend stored Telegram file");
    return false;
  }
}
