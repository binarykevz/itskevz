import { Api } from "telegram";
import { getTelegramClient } from "../telegram/client";
import { buildInputMedia } from "../telegram/media";
import type { TelegramFileRecord } from "../storage/telegram-files";

export async function sendExistingTelegramFile(
  peer: any,
  record: TelegramFileRecord
): Promise<void> {
  const client = getTelegramClient();
  const media = buildInputMedia(record);

  await client.invoke(
    new Api.messages.SendMedia({
      peer,
      media,
      message: "",
    } as any)
  );
}

export async function sendBufferAsDocument(
  peer: any,
  buffer: Buffer,
  fileName: string,
  caption?: string
): Promise<void> {
  const client = getTelegramClient();

  await client.sendFile(peer, {
    file: buffer,
    fileName,
    caption,
    forceDocument: true,
  } as any);
}
