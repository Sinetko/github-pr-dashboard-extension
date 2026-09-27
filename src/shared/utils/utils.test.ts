import { describe, expect, it } from 'vitest';

import {
  assertNever,
  base64ToBytes,
  base64UrlToBytes,
  bytesToBase64,
  bytesToBase64Url,
  compareBy,
  formatClockTime,
  formatRelativeTime,
  mapWithConcurrency,
  matchesSearch,
  TIME,
  uniqueBy,
} from '.';

const NOW = new Date('2026-01-15T12:00:00Z');
const ago = (milliseconds: number): Date => new Date(NOW.getTime() - milliseconds);

describe('formatRelativeTime', () => {
  it.each([
    [ago(10_000), 'just now'],
    [ago(5 * TIME.MINUTE), '5 minutes ago'],
    [ago(3 * TIME.HOUR), '3 hours ago'],
    [ago(TIME.DAY), 'yesterday'],
    [ago(3 * TIME.DAY), '3 days ago'],
    [ago(2 * TIME.WEEK), '2 weeks ago'],
    [ago(65 * TIME.DAY), '2 months ago'],
    [ago(800 * TIME.DAY), '2 years ago'],
    [new Date(NOW.getTime() + 2 * TIME.HOUR), 'in 2 hours'],
  ])('formats %s as %s', (date, expected) => {
    expect(formatRelativeTime(date, NOW)).toBe(expected);
  });

  it('accepts ISO strings and tolerates invalid input', () => {
    expect(formatRelativeTime('2026-01-15T11:00:00Z', NOW)).toBe('1 hour ago');
    expect(formatRelativeTime('not a date', NOW)).toBe('');
  });

  it('defaults "now" to the current time', () => {
    expect(formatRelativeTime(new Date())).toBe('just now');
  });
});

describe('formatClockTime', () => {
  it('zero-pads hours and minutes', () => {
    expect(formatClockTime(new Date(2026, 0, 1, 7, 5))).toBe('07:05');
    expect(formatClockTime(new Date(2026, 0, 1, 23, 59))).toBe('23:59');
  });
});

describe('mapWithConcurrency', () => {
  it('keeps order, caps in-flight work and isolates failures', async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (item) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      if (item === 4) {
        throw new Error('boom');
      }
      return item * 10;
    });
    expect(peak).toBe(3);
    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'rejected',
      'fulfilled',
      'fulfilled',
      'fulfilled',
    ]);
    expect(results[0]).toEqual({ status: 'fulfilled', value: 10 });
  });

  it('handles empty input and rejects invalid concurrency', async () => {
    await expect(mapWithConcurrency([], 6, () => Promise.resolve(1))).resolves.toEqual([]);
    await expect(mapWithConcurrency([1], 0, () => Promise.resolve(1))).rejects.toThrow(RangeError);
    await expect(mapWithConcurrency([1], 1.5, () => Promise.resolve(1))).rejects.toThrow(
      RangeError,
    );
  });
});

describe('base64', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 62, 63]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes);
  });

  it('produces url-safe unpadded output', () => {
    const encoded = bytesToBase64Url(new Uint8Array([251, 255, 191]));
    expect(encoded).toBe('-_-_');
    expect(bytesToBase64Url(new Uint8Array([1]))).toBe('AQ');
  });
});

describe('compare helpers', () => {
  it('compareBy sorts numbers and strings in both directions', () => {
    const items = [
      { name: 'beta', size: 2 },
      { name: 'Alpha', size: 3 },
      { name: 'gamma', size: 1 },
    ];
    expect([...items].sort(compareBy((item) => item.size)).map((item) => item.size)).toEqual([
      1, 2, 3,
    ]);
    expect(
      [...items].sort(compareBy((item) => item.name, 'desc')).map((item) => item.name),
    ).toEqual(['gamma', 'beta', 'Alpha']);
  });

  it('matchesSearch is case-insensitive and treats blank as match-all', () => {
    expect(matchesSearch(['Fix Login Bug', 'octocat'], 'login')).toBe(true);
    expect(matchesSearch(['Fix Login Bug'], 'OCTO')).toBe(false);
    expect(matchesSearch([], '   ')).toBe(true);
  });

  it('uniqueBy keeps first occurrence', () => {
    expect(
      uniqueBy(
        [
          { id: 'a', value: 1 },
          { id: 'a', value: 2 },
          { id: 'b', value: 3 },
        ],
        (item) => item.id,
      ),
    ).toEqual([
      { id: 'a', value: 1 },
      { id: 'b', value: 3 },
    ]);
  });
});

describe('assertNever', () => {
  it('throws with context', () => {
    expect(() => assertNever('x' as never, 'Unknown tab')).toThrow('Unknown tab: "x"');
    expect(() => assertNever(1 as never)).toThrow('Unexpected value: 1');
  });
});
