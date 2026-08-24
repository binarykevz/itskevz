import { run } from "./database";

export type StoredMediaType =
  | "photo"
  | "video"
  | "document"
  | "audio"
  | "voice"
  | "sticker"
  | "animation";

export interface TelegramFileRecord {
  id: string;
  ownerUserId: string;
  mediaType: StoredMediaType;
  telegramFileId?: string;
  telegramAccessHash?: string;
  telegramFileReference?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  caption?: string;
  aiDescription?: string;
  tags?: string;
  createdAt?: string;
}

export interface SaveTelegramFileInput {
  ownerUserId: string;
  mediaType: StoredMediaType;
  telegramFileId?: string;
  telegramAccessHash?: string;
  telegramFileReference?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  caption?: string;
  aiDescription?: string;
  tags?: string;
}

function rowToRecord(row: any): TelegramFileRecord {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    mediaType: row.media_type as StoredMediaType,
    telegramFileId: row.telegram_file_id ? String(row.telegram_file_id) : undefined,
    telegramAccessHash: row.telegram_access_hash
      ? String(row.telegram_access_hash)
      : undefined,
    telegramFileReference: row.telegram_file_reference
      ? String(row.telegram_file_reference)
      : undefined,
    fileName: row.file_name ? String(row.file_name) : undefined,
    mimeType: row.mime_type ? String(row.mime_type) : undefined,
    size: row.size === null || row.size === undefined ? undefined : Number(row.size),
    caption: row.caption ? String(row.caption) : undefined,
    aiDescription: row.ai_description ? String(row.ai_description) : undefined,
    tags: row.tags ? String(row.tags) : undefined,
    createdAt: String(row.created_at),
  };
}

export async function saveTelegramFile(
  input: SaveTelegramFileInput
): Promise<string> {
  if (input.telegramFileId) {
    const existing = await run(
      `
      SELECT id
      FROM telegram_files
      WHERE owner_user_id = ?
        AND telegram_file_id = ?
        AND media_type = ?
      LIMIT 1
      `,
      [input.ownerUserId, input.telegramFileId, input.mediaType]
    );

    const existingRow = existing.rows[0];

    if (existingRow) {
      const id = String(existingRow.id);

      await run(
        `
        UPDATE telegram_files
        SET
          telegram_access_hash = ?,
          telegram_file_reference = ?,
          file_name = ?,
          mime_type = ?,
          size = ?,
          caption = ?,
          ai_description = ?,
          tags = ?
        WHERE id = ?
        `,
        [
          input.telegramAccessHash ?? null,
          input.telegramFileReference ?? null,
          input.fileName ?? null,
          input.mimeType ?? null,
          input.size ?? null,
          input.caption ?? null,
          input.aiDescription ?? null,
          input.tags ?? null,
          id,
        ]
      );

      return id;
    }
  }

  const id = crypto.randomUUID();

  await run(
    `
    INSERT INTO telegram_files (
      id,
      owner_user_id,
      media_type,
      telegram_file_id,
      telegram_access_hash,
      telegram_file_reference,
      file_name,
      mime_type,
      size,
      caption,
      ai_description,
      tags,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `,
    [
      id,
      input.ownerUserId,
      input.mediaType,
      input.telegramFileId ?? null,
      input.telegramAccessHash ?? null,
      input.telegramFileReference ?? null,
      input.fileName ?? null,
      input.mimeType ?? null,
      input.size ?? null,
      input.caption ?? null,
      input.aiDescription ?? null,
      input.tags ?? null,
    ]
  );

  return id;
}

export async function searchTelegramFiles(
  ownerUserId: string,
  query: string,
  limit = 8
): Promise<TelegramFileRecord[]> {
  const like = `%${query}%`;

  const result = await run(
    `
    SELECT *
    FROM telegram_files
    WHERE owner_user_id = ?
      AND (
        file_name LIKE ?
        OR caption LIKE ?
        OR ai_description LIKE ?
        OR tags LIKE ?
      )
    ORDER BY created_at DESC
    LIMIT ?
    `,
    [ownerUserId, like, like, like, like, limit]
  );

  return (result.rows as any[]).map(rowToRecord);
}

export async function getFileForUser(
  ownerUserId: string,
  fileId: string
): Promise<TelegramFileRecord | null> {
  const result = await run(
    `
    SELECT *
    FROM telegram_files
    WHERE id = ?
      AND owner_user_id = ?
    LIMIT 1
    `,
    [fileId, ownerUserId]
  );

  const row = result.rows[0];

  return row ? rowToRecord(row) : null;
}

export async function updateFileAiDescription(
  fileId: string,
  description: string,
  tags?: string
): Promise<void> {
  await run(
    `
    UPDATE telegram_files
    SET
      ai_description = ?,
      tags = ?
    WHERE id = ?
    `,
    [description, tags ?? null, fileId]
  );
}
