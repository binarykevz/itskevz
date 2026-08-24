import { run } from "../storage/database";
import type { GeminiClient } from "./gemini";

export interface MemoryRow {
  id: string;
  userId: string;
  category:
    | "preference"
    | "personality"
    | "relationship"
    | "important_event"
    | "conversation_pattern"
    | "general";
  content: string;
  importance: number;
  createdAt?: string;
  lastUsedAt?: string;
}

const VALID_CATEGORIES = new Set([
  "preference",
  "personality",
  "relationship",
  "important_event",
  "conversation_pattern",
  "general",
]);

export async function getRelevantMemories(
  userId: string,
  limit = 8
): Promise<MemoryRow[]> {
  const result = await run(
    `
    SELECT *
    FROM memories
    WHERE user_id = ?
    ORDER BY importance DESC, COALESCE(last_used_at, created_at) DESC
    LIMIT ?
    `,
    [userId, limit]
  );

  const rows = result.rows as any[];

  if (rows.length === 0) {
    return [];
  }

  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => "?").join(",");

  await run(
    `
    UPDATE memories
    SET last_used_at = datetime('now')
    WHERE user_id = ?
      AND id IN (${placeholders})
    `,
    [userId, ...ids]
  );

  return rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    category: row.category,
    content: String(row.content),
    importance: Number(row.importance),
    createdAt: String(row.created_at),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : undefined,
  }));
}

async function saveMemory(
  userId: string,
  category: MemoryRow["category"],
  content: string,
  importance: number
): Promise<void> {
  const existing = await run(
    `
    SELECT id, importance
    FROM memories
    WHERE user_id = ?
      AND content = ?
    LIMIT 1
    `,
    [userId, content]
  );

  if (existing.rows[0]) {
    const id = String(existing.rows[0].id);
    const oldImportance = Number(existing.rows[0].importance);

    await run(
      `
      UPDATE memories
      SET importance = ?, last_used_at = datetime('now')
      WHERE id = ?
      `,
      [Math.max(oldImportance, importance), id]
    );

    return;
  }

  await run(
    `
    INSERT INTO memories (
      id,
      user_id,
      category,
      content,
      importance,
      created_at
    ) VALUES (?, ?, ?, ?, ?, datetime('now'))
    `,
    [crypto.randomUUID(), userId, category, content, importance]
  );
}

const MEMORY_EXTRACTION_SYSTEM = `
You extract durable memories from a conversation.

Return JSON only.

Allowed categories:
- preference
- personality
- relationship
- important_event
- conversation_pattern
- general

Rules:
- Store only durable, useful facts.
- Do not store secrets, medical details, or sensitive data unless explicitly important.
- Do not store transient chatter unless it reveals a stable preference or pattern.
- If nothing is worth remembering, return an empty array.

Output shape:
{
  "memories": [
    {
      "category": "preference",
      "content": "User prefers short casual replies",
      "importance": 0.72
    }
  ]
}
`.trim();

export async function extractMemories(
  gemini: GeminiClient,
  userId: string,
  userMessage: string,
  assistantMessage: string
): Promise<void> {
  if (!userMessage.trim() && !assistantMessage.trim()) {
    return;
  }

  const parsed = await gemini.generateJson<{
    memories: Array<{
      category: string;
      content: string;
      importance: number;
    }>;
  }>(
    {
      system: MEMORY_EXTRACTION_SYSTEM,
      parts: [
        {
          text: JSON.stringify({
            user: userMessage,
            assistant: assistantMessage,
          }),
        },
      ],
      maxOutputTokens: 1024,
    },
    {
      memories: [],
    }
  );

  for (const memory of parsed.memories ?? []) {
    if (!memory?.content?.trim()) continue;

    const importance = Number(memory.importance ?? 0);

    if (importance < 0.55) continue;
    if (memory.content.length < 8) continue;

    const category = VALID_CATEGORIES.has(memory.category)
      ? (memory.category as MemoryRow["category"])
      : "general";

    await saveMemory(userId, category, memory.content.trim(), importance);
  }
}
