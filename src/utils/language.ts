export interface LanguageDetection {
  dominant: "english" | "tagalog" | "taglish" | "bicol" | "mixed";
  bicol: boolean;
  scores: {
    english: number;
    tagalog: number;
    bicol: number;
  };
}

const BICOL_WORDS = new Set([
  "aram",
  "dai",
  "gadan",
  "tabi",
  "igwa",
  "mayo",
  "boot",
  "bako",
  "saimo",
  "sakuya",
  "harani",
  "halat",
  "padaba",
  "namomotan",
  "nanggad",
  "baya",
  "gurang",
  "aki",
  "dakula",
  "sadit",
]);

const TAGALOG_WORDS = new Set([
  "ako",
  "ikaw",
  "siya",
  "kami",
  "tayo",
  "nila",
  "ano",
  "bakit",
  "paano",
  "saan",
  "kailan",
  "hindi",
  "oo",
  "wala",
  "meron",
  "naman",
  "lang",
  "muna",
  "sana",
  "grabe",
  "talaga",
  "kasi",
  "kuya",
  "ate",
  "bes",
  "lods",
  "charot",
  "nako",
  "hay",
]);

const ENGLISH_WORDS = new Set([
  "the",
  "and",
  "you",
  "are",
  "what",
  "when",
  "where",
  "why",
  "how",
  "hello",
  "love",
  "okay",
  "ok",
  "please",
  "thanks",
  "thank",
  "sorry",
  "good",
  "bad",
  "really",
  "because",
  "today",
  "tomorrow",
  "yesterday",
]);

const BICOL_PHRASES: Array<[RegExp, number]> = [
  [/ano man/i, 2],
  [/ka man/i, 1],
  [/dai (ko|ka|na|mo|niya)/i, 3],
  [/aram (ko|ka|mo|niya)/i, 3],
  [/igwa (ako|siya|kami|kita)/i, 3],
  [/mayo (ako|siya|kami|kita)/i, 2],
  [/sakuya (boot|naman)/i, 2],
];

export function detectLanguage(text: string): LanguageDetection {
  const scores = {
    english: 0,
    tagalog: 0,
    bicol: 0,
  };

  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\s']/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    if (BICOL_WORDS.has(token)) scores.bicol += 1;
    if (TAGALOG_WORDS.has(token)) scores.tagalog += 1;
    if (ENGLISH_WORDS.has(token)) scores.english += 1;
  }

  for (const [pattern, weight] of BICOL_PHRASES) {
    if (pattern.test(text)) {
      scores.bicol += weight;
    }
  }

  const total = tokens.length || 1;

  const bicol =
    scores.bicol >= 2 || scores.bicol / total >= 0.1;

  let dominant: LanguageDetection["dominant"] = "mixed";

  const max = Math.max(scores.english, scores.tagalog, scores.bicol);

  if (max === 0) {
    dominant = "english";
  } else if (scores.bicol === max && bicol) {
    dominant = "bicol";
  } else if (scores.tagalog === max && scores.english > 0) {
    dominant = "taglish";
  } else if (scores.tagalog === max) {
    dominant = "tagalog";
  } else if (scores.english === max) {
    dominant = "english";
  }

  if (
    !bicol &&
    scores.tagalog > 0 &&
    scores.english > 0 &&
    scores.tagalog / total >= 0.08 &&
    scores.english / total >= 0.08
  ) {
    dominant = "taglish";
  }

  return {
    dominant,
    bicol,
    scores,
  };
}
