import { run } from "../storage/database";
import { vipBootstrapIds } from "../config/env";

export interface VipProfileRow {
  userId: string;
  name?: string;
  personalityProfile?: string;
  preferredLanguage?: string;
  relationshipStyle?: string;
  mood?: string;
  conversationSummary?: string;
  enabled: boolean;
}

export interface TelegramUserInfo {
  firstName?: string;
  lastName?: string;
  username?: string;
}

export async function ensureUser(
  userId: string,
  info: TelegramUserInfo
): Promise<void> {
  await run(
    `
    INSERT INTO users (
      id,
      username,
      first_name,
      last_name,
      is_vip,
      created_at,
      last_seen_at
    ) VALUES (?, ?, ?, ?, 0, datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      last_seen_at = datetime('now')
    `,
    [userId, info.username ?? null, info.firstName ?? null, info.lastName ?? null]
  );
}

export async function isVip(userId: string): Promise<boolean> {
  const result = await run(
    `
    SELECT
      u.is_vip,
      COALESCE(p.enabled, 1) AS enabled
    FROM users u
    LEFT JOIN vip_profiles p ON p.user_id = u.id
    WHERE u.id = ?
    LIMIT 1
    `,
    [userId]
  );

  const row = result.rows[0];

  if (!row) {
    return false;
  }

  return Boolean(Number(row.is_vip) === 1 && Number(row.enabled) === 1);
}

export async function setVip(userId: string, enabled: boolean): Promise<void> {
  await ensureUser(userId, {});

  await run(
    `
    UPDATE users
    SET is_vip = ?
    WHERE id = ?
    `,
    [enabled ? 1 : 0, userId]
  );

  await run(
    `
    INSERT INTO vip_profiles (
      user_id,
      enabled,
      updated_at
    ) VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      enabled = excluded.enabled,
      updated_at = datetime('now')
    `,
    [userId, enabled ? 1 : 0]
  );
}

export async function syncEnvVips(): Promise<void> {
  for (const userId of vipBootstrapIds) {
    await setVip(userId, true);
  }
}

export async function getVipProfile(
  userId: string
): Promise<VipProfileRow | null> {
  const result = await run(
    `
    SELECT *
    FROM vip_profiles
    WHERE user_id = ?
    LIMIT 1
    `,
    [userId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    userId: String(row.user_id),
    name: row.name ? String(row.name) : undefined,
    personalityProfile: row.personality_profile
      ? String(row.personality_profile)
      : undefined,
    preferredLanguage: row.preferred_language
      ? String(row.preferred_language)
      : undefined,
    relationshipStyle: row.relationship_style
      ? String(row.relationship_style)
      : undefined,
    mood: row.mood ? String(row.mood) : undefined,
    conversationSummary: row.conversation_summary
      ? String(row.conversation_summary)
      : undefined,
    enabled: Number(row.enabled) === 1,
  };
}
