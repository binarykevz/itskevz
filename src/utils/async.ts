export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const retries = options.retries ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 700;
  const shouldRetry = options.shouldRetry;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === retries) {
        throw error;
      }

      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      const delay = baseDelayMs * 2 ** attempt + Math.random() * 250;
      await sleep(delay);
    }
  }

  throw lastError;
}

export class KeyMutex {
  private locks = new Map<string, Promise<unknown>>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();

    const current = previous.then(fn, fn);
    const safeCurrent = current.catch(() => undefined);

    this.locks.set(key, safeCurrent);

    try {
      return await current;
    } finally {
      if (this.locks.get(key) === safeCurrent) {
        this.locks.delete(key);
      }
    }
  }
}
