import { run } from "../storage/database";
import {
  getRecentMessages,
  formatRecentForPrompt,
} from "../storage/conversations";
import { upsertPersonalityProfile, type PersonalityProfileRow } from "../vip/profiles";
import type { GeminiClient } from "./gemini";

const PERSONALITY_ANALYSIS_SYSTEM = `
Analyze the user's communication style from the conversation.

Return JSON only.

Fields:
- tone
- formality
- emojiUsage
- language
- humor
- affection
- preferredResponseLength

Use short values like:
- playful
- serious
- very casual
- high
- moderate
- low
- Taglish
- Bicol mix
- sarcastic
- short
- medium
`.trim();

export async function maybeLearnPersonality(
  gemini: GeminiClient,
  userId: string,
  isVip: boolean
): Promise<void> {
  if (!isVip) return;

  const countResult = await run(
    `
    SELECT COUNT(*) AS c
    FROM conversations
    WHERE user_id = ?
      AND role = 'user'
    `,
    [userId]
  );

  const count = Number(countResult.rows[0]?.c ?? 0);

  if (count < 20 || count % 20 !== 0) {
    return;
  }

  const recent = await getRecentMessages(userId, 50);

  if (recent.length < 10) {
    return;
  }

  const conversation = formatRecentForPrompt(recent, 8000);

  const analysis = await gemini.generateJson<{
    tone?: string;
    formality?: string;
    emojiUsage?: string;
    language?: string;
    humor?: string;
    affection?: string;
    preferredResponseLength?: string;
  }>(
    {
      system: PERSONALITY_ANALYSIS_SYSTEM,
      parts: [{ text: conversation }],
      maxOutputTokens: 1024,
    },
    {}
  );

  const profile: PersonalityProfileRow = {
    tone: analysis.tone,
    formality: analysis.formality,
    emojiUsage: analysis.emojiUsage,
    language: analysis.language,
    humor: analysis.humor,
    affection: analysis.affection,
    preferredResponseLength: analysis.preferredResponseLength,
  };

  await upsertPersonalityProfile(userId, profile);
}
