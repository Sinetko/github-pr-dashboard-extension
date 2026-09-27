import type { BadgeAppearance } from '@core/chrome/action-badge';
import { endpointsFor } from '@core/github';
import type { TokenVault } from '@core/security';
import type { CacheRecord, PollingRecord, Repository, SettingsRecord } from '@core/storage';

import { countReviewWork, resolveBadgeState, type BadgeState } from './badge-state';

export interface BadgeUpdaterDependencies {
  settings: Pick<Repository<SettingsRecord>, 'read'>;
  polling: Pick<Repository<PollingRecord>, 'read'>;
  cache: Pick<Repository<CacheRecord>, 'read'>;
  vault: Pick<TokenVault, 'getStatus' | 'hasToken'>;
  setBadge: (appearance: BadgeAppearance) => Promise<void>;
}

export const refreshBadge = async ({
  settings,
  polling,
  cache,
  vault,
  setBadge,
}: BadgeUpdaterDependencies): Promise<BadgeState> => {
  const [settingsValue, pollingValue, cacheValue, status, hasToken] = await Promise.all([
    settings.read(),
    polling.read(),
    cache.read(),
    vault.getStatus(),
    vault.hasToken(),
  ]);
  const hostPrefix = `${endpointsFor(settingsValue.host).hostKey}|`;
  const lists = Object.entries(cacheValue.entries)
    .filter(([key]) => key.startsWith(hostPrefix))
    .map(([, entry]) => entry.pullRequests);
  const counts = countReviewWork(
    lists,
    pollingValue.viewer?.value.login ?? null,
    pollingValue.viewerTeams?.value ?? null,
  );
  const state = resolveBadgeState({
    isConfigured: settingsValue.sources.length > 0 && hasToken,
    isLocked: status !== 'unlocked',
    consecutiveFailures: pollingValue.consecutiveFailures,
    ...counts,
  });
  await setBadge({
    text: state.text,
    backgroundColor: state.backgroundColor,
    textColor: state.textColor,
    title: state.title,
  });
  return state;
};
