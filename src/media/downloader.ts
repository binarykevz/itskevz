import { getTelegramClient } from "../telegram/client";
import { env } from "../config/env";
import { classifyIncomingMedia } from "../telegram/media";

export async function downloadMessageMediaBuffer(
  message: any
): Promise<Buffer | null> {
  const info = classifyIncomingMedia(message);

  if (info?.size && info.size > env.MAX_DOWNLOAD_MEDIA_BYTES) {
    return null;
  }

  const client = getTelegramClient();

  const downloaded = await client.downloadMedia(message, {} as any);

  if (!downloaded) {
    return null;
  }

  if (Buffer.isBuffer(downloaded)) {
    return downloaded;
  }

  if (downloaded instanceof Uint8Array) {
    return Buffer.from(downloaded);
  }

  if (typeof downloaded === "string") {
    return Buffer.from(downloaded, "binary");
  }

  return null;
}
