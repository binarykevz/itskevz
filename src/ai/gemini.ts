import { withRetry } from "../utils/async";
import { safeJsonParse } from "../utils/text";

export interface GeminiInlineData {
  mimeType: string;
  data: string;
}

export interface GeminiFileData {
  fileUri: string;
  mimeType: string;
}

export interface GeminiPart {
  text?: string;
  inlineData?: GeminiInlineData;
  fileData?: GeminiFileData;
}

export interface GenerateOptions {
  system: string;
  parts: GeminiPart[];
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean;
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function isRetryableError(error: unknown): boolean {
  if (error instanceof GeminiError) {
    return [429, 500, 502, 503, 504].includes(error.status ?? 0);
  }

  const message = String((error as Error)?.message ?? "");

  return /fetch failed|timeout|ECONNRESET|ETIMEDOUT/i.test(message);
}

export class GeminiClient {
  constructor(
    private apiKey: string,
    private primaryModel: string,
    private analysisModel: string
  ) {}

  async generate(options: GenerateOptions): Promise<string> {
    const model = options.model ?? this.primaryModel;
    const url = `${BASE_URL}/models/${model}:generateContent`;

    const payload = {
      systemInstruction: {
        parts: [{ text: options.system }],
      },
      contents: [
        {
          role: "user",
          parts: options.parts,
        },
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.8,
        maxOutputTokens: options.maxOutputTokens ?? 1024,
        ...(options.json ? { responseMimeType: "application/json" } : {}),
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_ONLY_HIGH",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_ONLY_HIGH",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_ONLY_HIGH",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_ONLY_HIGH",
        },
      ],
    };

    const data = await withRetry(
      async () => {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(60_000),
        });

        const text = await response.text();

        if (!response.ok) {
          throw new GeminiError(
            `Gemini HTTP ${response.status}: ${text.slice(0, 300)}`,
            response.status
          );
        }

        return JSON.parse(text);
      },
      {
        retries: 4,
        baseDelayMs: 800,
        shouldRetry: isRetryableError,
      }
    );

    if (data.promptFeedback?.blockReason) {
      throw new GeminiError(`Gemini blocked request: ${data.promptFeedback.blockReason}`);
    }

    const candidate = data.candidates?.[0];

    if (!candidate?.content?.parts) {
      throw new GeminiError("Gemini returned no usable candidate");
    }

    if (candidate.finishReason === "SAFETY") {
      throw new GeminiError("Gemini response blocked for safety");
    }

    return candidate.content.parts
      .map((part: any) => part.text ?? "")
      .join("")
      .trim();
  }

  async generateJson<T>(options: GenerateOptions, fallback: T): Promise<T> {
    const model = options.model ?? this.analysisModel;

    const text = await this.generate({
      ...options,
      model,
      json: true,
      maxOutputTokens: options.maxOutputTokens ?? 2048,
    });

    return safeJsonParse(text, fallback);
  }
}
