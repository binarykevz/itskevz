import { run } from "../storage/database";

export type Mood =
  | "happy"
  | "excited"
  | "playful"
  | "sad"
  | "lonely"
  | "angry"
  | "frustrated"
  | "stressed"
  | "neutral"
  | "confused"
  | "tired";

export interface MoodState {
  mood: Mood;
  confidence: number;
  reason?: string;
}

const MOOD_KEYWORDS: Record<Mood, string[]> = {
  happy: [
    "happy",
    "masaya",
    "saya",
    "nice",
    "ganda",
    "awesome",
    "yay",
    "woohoo",
    "finally",
  ],
  excited: [
    "excited",
    "grabe",
    "cant wait",
    "can't wait",
    "wow",
    "omg",
    "finally",
  ],
  playful: [
    "haha",
    "hahaha",
    "ahaha",
    "lol",
    "charot",
    "joke",
    "😂",
    "🤣",
    "😭",
  ],
  sad: [
    "sad",
    "malungkot",
    "lungkot",
    "iyak",
    "umiiyak",
    "hurt",
    "sakit",
    "dai ko na",
    "gabaton",
  ],
  lonely: [
    "lonely",
    "alone",
    "magisa",
    "nag-iisa",
    "walang kausap",
    "walang kasama",
  ],
  angry: [
    "angry",
    "galit",
    "nakakainis",
    "init ulo",
    "bwisit",
    "leche",
    "gago",
    "suko na",
  ],
  frustrated: [
    "frustrated",
    "frustrating",
    "nakakafrustrate",
    "suko",
    "ayaw",
    "dai na",
  ],
  stressed: [
    "stress",
    "stressed",
    "pressure",
    "overwhelmed",
    "deadline",
    "exam",
    "work",
    "pagod",
  ],
  confused: [
    "confused",
    "huh",
    "ano",
    "di ko alam",
    "hindi ko alam",
    "ewan",
    "what",
  ],
  tired: [
    "tired",
    "pagod",
    "exhausted",
    "drained",
    "antok",
    "sleepy",
  ],
  neutral: [],
};

const MOOD_PRIORITY: Mood[] = [
  "sad",
  "angry",
  "stressed",
  "lonely",
  "frustrated",
  "tired",
  "confused",
  "happy",
  "excited",
  "playful",
  "neutral",
];

export function detectMood(text: string): MoodState {
  const lower = text.toLowerCase();

  const scores = Object.fromEntries(
    MOOD_PRIORITY.map((mood) => [mood, 0])
  ) as Record<Mood, number>;

  for (const mood of MOOD_PRIORITY) {
    const keywords = MOOD_KEYWORDS[mood];

    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        scores[mood] += 1;
      }
    }
  }

  if (/!{2,}/.test(text)) {
    scores.excited += 1;
  }

  if (/HAHAHA/i.test(text)) {
    scores.playful += 2;
  }

  const candidates = MOOD_PRIORITY.map((mood) => ({
    mood,
    score: scores[mood],
  }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        MOOD_PRIORITY.indexOf(a.mood) - MOOD_PRIORITY.indexOf(b.mood)
    );

  if (candidates.length === 0) {
    return {
      mood: "neutral",
      confidence: 0.35,
      reason: "No strong emotional signal",
    };
  }

  const best = candidates[0]!;

  return {
    mood: best.mood,
    confidence: Math.min(0.95, 0.45 + best.score * 0.1),
    reason: `${best.score} emotional signal(s) detected`,
  };
}

export async function persistMood(userId: string, mood: MoodState): Promise<void> {
  await run(
    `
    INSERT INTO moods (
      user_id,
      mood,
      confidence,
      reason,
      detected_at
    ) VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      mood = excluded.mood,
      confidence = excluded.confidence,
      reason = excluded.reason,
      detected_at = excluded.detected_at
    `,
    [userId, mood.mood, mood.confidence, mood.reason ?? null]
  );
}
