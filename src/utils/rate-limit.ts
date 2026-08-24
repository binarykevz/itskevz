export class SlidingWindowRateLimiter {
  private windows = new Map<string, number[]>();

  constructor(private readonly windowMs = 60_000) {}

  allow(key: string, limit: number): boolean {
    const now = Date.now();
    const current = this.windows.get(key) ?? [];
    const valid = current.filter((timestamp) => now - timestamp < this.windowMs);

    if (valid.length >= limit) {
      this.windows.set(key, valid);
      return false;
    }

    valid.push(now);
    this.windows.set(key, valid);
    return true;
  }
}
