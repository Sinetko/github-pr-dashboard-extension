export interface RateLimitSnapshot {
  limit: number;
  remaining: number;
  resetAt: Date;
}

const parseInteger = (value: string | null): number | null => {
  if (value === null || !/^\d+$/.test(value.trim())) {
    return null;
  }
  return Number(value.trim());
};

export const readRateLimit = (headers: Headers): RateLimitSnapshot | null => {
  const limit = parseInteger(headers.get('x-ratelimit-limit'));
  const remaining = parseInteger(headers.get('x-ratelimit-remaining'));
  const reset = parseInteger(headers.get('x-ratelimit-reset'));
  if (limit === null || remaining === null || reset === null) {
    return null;
  }
  return { limit, remaining, resetAt: new Date(reset * 1000) };
};

export const readRetryAfterSeconds = (headers: Headers, now: Date): number | null => {
  const value = headers.get('retry-after');
  if (value === null) {
    return null;
  }
  const seconds = parseInteger(value);
  if (seconds !== null) {
    return seconds;
  }
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - now.getTime()) / 1000));
};

export const DEFAULT_SECONDARY_RETRY_SECONDS = 60;
