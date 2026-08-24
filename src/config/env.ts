import { z } from "zod";
import { mkdirSync } from "node:fs";
import path from "node:path";

const envSchema = z.object({
  TELEGRAM_API_ID: z.coerce.number().int().positive(),
  TELEGRAM_API_HASH: z.string().min(8),
  TELEGRAM_SESSION: z.string().default(""),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
  GEMINI_ANALYSIS_MODEL: z.string().optional(),

  DATABASE_URL: z.string().default("file:./data/kevin.db"),
  TURSO_AUTH_TOKEN: z.string().optional(),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug"]).default("info"),

  VIP_USER_IDS: z.string().optional(),
  ADMIN_IDS: z.string().optional(),

  MEDIA_TMP_DIR: z.string().default("./tmp"),

  MAX_INLINE_MEDIA_BYTES: z.coerce.number().int().positive().default(8_000_000),
  MAX_DOWNLOAD_MEDIA_BYTES: z.coerce.number().int().positive().default(25_000_000),

  RATE_LIMIT_VIP_PER_MIN: z.coerce.number().int().positive().default(40),
  RATE_LIMIT_NORMAL_PER_MIN: z.coerce.number().int().positive().default(12),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

if (env.DATABASE_URL.startsWith("libsql://") && !env.TURSO_AUTH_TOKEN) {
  console.error("TURSO_AUTH_TOKEN is required when DATABASE_URL uses libsql://");
  process.exit(1);
}

export const vipBootstrapIds = (env.VIP_USER_IDS ?? "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

export const adminIds = (env.ADMIN_IDS ?? "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

export const analysisModel = env.GEMINI_ANALYSIS_MODEL ?? env.GEMINI_MODEL;

try {
  mkdirSync(env.MEDIA_TMP_DIR, { recursive: true });

  if (env.DATABASE_URL.startsWith("file:")) {
    const filePath = env.DATABASE_URL.replace(/^file:/, "");
    mkdirSync(path.dirname(filePath), { recursive: true });
  }
} catch (err) {
  console.error("Failed preparing local directories", err);
}
