import type { NotificationSettings } from '@core/storage';

import type { PullRequestEvent } from './pull-request-events';

export const LEDGER_RETENTION_DAYS = 30;
const DAY_MILLISECONDS = 86_400_000;

export const selectNotifiableEvents = (
  events: readonly PullRequestEvent[],
  ledger: Readonly<Record<string, string>>,
  settings: NotificationSettings,
): PullRequestEvent[] => {
  if (!settings.enabled) {
    return [];
  }
  const seen = new Set<string>();
  return events.filter((event) => {
    if (!settings.types[event.type] || event.key in ledger || seen.has(event.key)) {
      return false;
    }
    seen.add(event.key);
    return true;
  });
};

export const recordEvents = (
  ledger: Readonly<Record<string, string>>,
  events: readonly PullRequestEvent[],
  now: Date,
): Record<string, string> => {
  const cutoff = now.getTime() - LEDGER_RETENTION_DAYS * DAY_MILLISECONDS;
  const next: Record<string, string> = {};
  for (const [key, at] of Object.entries(ledger)) {
    if (Date.parse(at) >= cutoff) {
      next[key] = at;
    }
  }
  for (const event of events) {
    next[event.key] ??= now.toISOString();
  }
  return next;
};
