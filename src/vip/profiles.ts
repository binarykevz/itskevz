import { run } from "../storage/database";

export interface PersonalityProfileRow {
  tone?: string;
  formality?: string;
  emojiUsage?: string;
  language?: string;
  humor?: string;
  affection?: string;
  preferredResponseLength?: string;
}

export async function getPersonalityProfile(
  userId: string
): Promise<PersonalityProfileRow | null> {
  const result = await run(
    `
    SELECT *
    FROM personality_profiles
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
    tone: row.tone ? String(row.tone) : undefined,
    formality: row.formality ? String(row.formality) : undefined,
    emojiUsage: row.emoji_usage ? String(row.emoji_usage) : undefined,
    language: row.language ? String(row.language) : undefined,
    humor: row.humor ? String(row.humor) : undefined,
    affection: row.affection ? String(row.affection) : undefined,
    preferredResponseLength: row.preferred_response_length
      ? String(row.preferred_response_length)
      : undefined,
  };
}

export async function upsertPersonalityProfile(
  userId: string,
  profile: PersonalityProfileRow
): Promise<void> {
  await run(
    `
    INSERT INTO personality_profiles (
      user_id,
      tone,
      formality,
      emoji_usage,
      language,
      humor,
      affection,
      preferred_response_length,
      raw_json,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      tone = excluded.tone,
      formality = excluded.formality,
      emoji_usage = excluded.emoji_usage,
      language = excluded.language,
      humor = excluded.humor,
      affection = excluded.affection,
      preferred_response_length = excluded.preferred_response_length,
      raw_json = excluded.raw_json,
      updated_at = datetime('now')
    `,
    [
      userId,
      profile.tone ?? null,
      profile.formality ?? null,
      profile.emojiUsage ?? null,
      profile.language ?? null,
      profile.humor ?? null,
      profile.affection ?? null,
      profile.preferredResponseLength ?? null,
      JSON.stringify(profile),
    ]
  );
}
