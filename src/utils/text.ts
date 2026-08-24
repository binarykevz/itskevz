export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

export function chunkTelegramText(text: string, maxLength = 4096): string[] {
  const clean = text.trim();

  if (!clean) {
    return [];
  }

  if (clean.length <= maxLength) {
    return [clean];
  }

  const chunks: string[] = [];
  let remaining = clean;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitAt = remaining.lastIndexOf("\n", maxLength);

    if (splitAt < maxLength * 0.45) {
      splitAt = remaining.lastIndexOf(" ", maxLength);
    }

    if (splitAt < maxLength * 0.45) {
      splitAt = maxLength;
    }

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  return chunks.filter(Boolean);
}

export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // ignore
  }

  const fenced = raw.match(/```(?:json)?\n?([\s\S]*?)```/i)?.[1];

  if (fenced) {
    try {
      return JSON.parse(fenced) as T;
    } catch {
      // ignore
    }
  }

  const objectLike = raw.match(/[\[{][\s\S]*[\]}]/);

  if (objectLike) {
    try {
      return JSON.parse(objectLike[0]) as T;
    } catch {
      // ignore
    }
  }

  return fallback;
}

export function cleanAssistantText(text: string): string {
  let out = text.trim();

  out = out.replace(/^["']+|["']+$/g, "");
  out = out.replace(/^(Kevin|Bobyyy|Love)\s*:\s*/i, "");
  out = out.replace(/^```[\s\S]*```$/g, "");

  return out.trim();
}
