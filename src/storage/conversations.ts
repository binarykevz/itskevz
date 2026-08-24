import { run } from "./database";

export interface ConversationRow {
  id?: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  mediaType?: string | null;
  mediaId?: string | null;
  createdAt?: string;
}

export async function saveConversation(entry: ConversationRow): Promise<void> {
  const id = crypto.randomUUID();

  await run(
    `
    INSERT INTO conversations (
      id,
      user_id,
      role,
      content,
      media_type,
      media_id,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `,
    [
      id,
      entry.userId,
      entry.role,
      entry.content ?? "",
      entry.mediaType ?? null,
      entry.mediaId ?? null,
    ]
  );
}

export async function getRecentMessages(
  userId: string,
  limit = 30
): Promise<ConversationRow[]> {
  const result = await run(
    `
    SELECT
      id,
      user_id,
      role,
      content,
      media_type,
      media_id,
      created_at
    FROM conversations
    WHERE user_id = ?
    ORDER BY created_at DESC, rowid DESC
    LIMIT ?
    `,
    [userId, limit]
  );

  return (result.rows as any[])
    .map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      role: row.role as "user" | "assistant",
      content: String(row.content ?? ""),
      mediaType: row.media_type ? String(row.media_type) : null,
      mediaId: row.media_id ? String(row.media_id) : null,
      createdAt: String(row.created_at),
    }))
    .reverse();
}

export function formatRecentForPrompt(
  rows: ConversationRow[],
  maxChars = 6000
): string {
  const lines = rows.map((row) => {
    const speaker = row.role === "user" ? "User" : "Kevin";
    const content = row.content?.trim() || `[${row.mediaType ?? "media"}]`;
    return `${speaker}: ${content}`;
  });

  const text = lines.join("\n");

  if (text.length <= maxChars) {
    return text;
  }

  return text.slice(text.length - maxChars);
}
