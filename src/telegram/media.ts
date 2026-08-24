import { Api } from "telegram";
import type {
  StoredMediaType,
  TelegramFileRecord,
} from "../storage/telegram-files";

export interface IncomingMediaInfo {
  mediaType: StoredMediaType;
  telegramFileId?: string;
  telegramAccessHash?: string;
  telegramFileReference?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
}

function toBase64(value: unknown): string | undefined {
  if (!value) return undefined;

  if (Buffer.isBuffer(value)) {
    return value.toString("base64");
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("base64");
  }

  if (typeof value === "string") {
    return Buffer.from(value, "binary").toString("base64");
  }

  return undefined;
}

function extensionFromMime(mimeType?: string): string {
  if (!mimeType) return "bin";

  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("plain")) return "txt";
  if (mimeType.includes("json")) return "json";

  return "bin";
}

export function classifyIncomingMedia(message: any): IncomingMediaInfo | null {
  if (!message) return null;

  const photo = message.photo ?? message.media?.photo;
  const document = message.document ?? message.media?.document;

  if (photo) {
    return {
      mediaType: "photo",
      telegramFileId: String(photo.id ?? ""),
      telegramAccessHash: String(photo.accessHash ?? ""),
      telegramFileReference: toBase64(photo.fileReference),
      mimeType: "image/jpeg",
      size: photo.size ? Number(photo.size) : undefined,
    };
  }

  if (!document) {
    return null;
  }

  const attributes: any[] = document.attributes ?? [];

  let mediaType: StoredMediaType = "document";
  let fileName: string | undefined;

  for (const attribute of attributes) {
    const className = attribute?.className;

    if (className === "DocumentAttributeFilename") {
      fileName = attribute.fileName;
    }

    if (className === "DocumentAttributeSticker") {
      mediaType = "sticker";
    }

    if (className === "DocumentAttributeAudio") {
      mediaType = attribute.voice ? "voice" : "audio";
    }

    if (className === "DocumentAttributeVideo") {
      mediaType = "video";
    }

    if (className === "DocumentAttributeAnimated") {
      mediaType = "animation";
    }
  }

  const mimeType = document.mimeType ? String(document.mimeType) : undefined;

  if (mediaType === "document" && mimeType?.startsWith("audio/")) {
    mediaType = "audio";
  }

  if (mediaType === "document" && mimeType?.startsWith("video/")) {
    mediaType = "video";
  }

  if (!fileName) {
    fileName = `file.${extensionFromMime(mimeType)}`;
  }

  return {
    mediaType,
    telegramFileId: String(document.id ?? ""),
    telegramAccessHash: String(document.accessHash ?? ""),
    telegramFileReference: toBase64(document.fileReference),
    fileName,
    mimeType,
    size: document.size === undefined ? undefined : Number(document.size),
  };
}

export function buildInputMedia(record: TelegramFileRecord): Api.TypeInputMedia {
  if (!record.telegramFileId || !record.telegramAccessHash) {
    throw new Error("Missing Telegram media reference");
  }

  const id = BigInt(record.telegramFileId);
  const accessHash = BigInt(record.telegramAccessHash);
  const fileReference = Buffer.from(record.telegramFileReference ?? "", "base64");

  if (record.mediaType === "photo") {
    return new Api.InputMediaPhoto({
      id: new Api.InputPhoto({
        id,
        accessHash,
        fileReference,
      } as any),
    } as any);
  }

  return new Api.InputMediaDocument({
    id: new Api.InputDocument({
      id,
      accessHash,
      fileReference,
    } as any),
  } as any);
}
