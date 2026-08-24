import { createClient, type Client } from "@libsql/client";
import { env } from "../config/env";

export const db: Client = createClient({
  url: env.DATABASE_URL,
  authToken: env.DATABASE_URL.startsWith("libsql://")
    ? env.TURSO_AUTH_TOKEN
    : undefined,
});

export async function run(sql: string, args: unknown[] = []) {
  return db.execute({
    sql,
    args: args.map((value) => (value === undefined ? null : value)) as any[],
  });
}

const schema = [
  `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    is_vip INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS vip_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    name TEXT,
    personality_profile TEXT,
    preferred_language TEXT,
    relationship_style TEXT,
    mood TEXT,
    conversation_summary TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS conversations (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT,
    media_type TEXT,
    media_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_conversations_user_seq
  ON conversations (user_id, seq DESC)
  `,

  `
  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    importance REAL NOT NULL DEFAULT 0.5,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
  )
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_memories_user_importance
  ON memories (user_id, importance DESC)
  `,

  `
  CREATE TABLE IF NOT EXISTS personality_profiles (
    user_id TEXT PRIMARY KEY,
    tone TEXT,
    formality TEXT,
    emoji_usage TEXT,
    language TEXT,
    humor TEXT,
    affection TEXT,
    preferred_response_length TEXT,
    raw_json TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS moods (
    user_id TEXT PRIMARY KEY,
    mood TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0,
    reason TEXT,
    detected_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
  `,

  `
  CREATE TABLE IF NOT EXISTS telegram_files (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    media_type TEXT NOT NULL,
    telegram_file_id TEXT,
    telegram_access_hash TEXT,
    telegram_file_reference TEXT,
    file_name TEXT,
    mime_type TEXT,
    size INTEGER,
    caption TEXT,
    ai_description TEXT,
    tags TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_telegram_files_owner_created
  ON telegram_files (owner_user_id, created_at DESC)
  `,

  `
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
  `,
];

export async function initDatabase(): Promise<void> {
  for (const statement of schema) {
    await db.execute(statement);
  }
}
