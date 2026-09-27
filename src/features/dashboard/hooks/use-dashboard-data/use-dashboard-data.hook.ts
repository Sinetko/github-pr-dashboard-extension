import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';

import { endpointsFor } from '@core/github';
import { cacheKey, DEFAULT_POLLING, type CacheRecord, type PollingRecord } from '@core/storage';

import type { DashboardData } from './use-dashboard-data.types';
import type { DashboardServices } from '../../model/dashboard-services.types';

export const useDashboardData = (services: DashboardServices): DashboardData => {
  const settings = useStore(services.settings.store, (state) => state.value);
  const [cache, setCache] = useState<CacheRecord | null>(null);
  const [polling, setPolling] = useState<PollingRecord>(DEFAULT_POLLING);

  useEffect(() => {
    let isCurrent = true;
    const unsubscribeCache = services.cache.subscribe(setCache);
    const unsubscribePolling = services.polling.subscribe(setPolling);
    void Promise.all([services.cache.read(), services.polling.read()]).then(
      ([cacheValue, pollingValue]) => {
        if (isCurrent) {
          setCache(cacheValue);
          setPolling(pollingValue);
        }
      },
    );
    return () => {
      isCurrent = false;
      unsubscribeCache();
      unsubscribePolling();
    };
  }, [services]);

  return useMemo(() => {
    const activeSource =
      settings.sources.find((source) => source.id === settings.activeSourceId) ??
      settings.sources[0] ??
      null;
    const key =
      activeSource === null ? null : cacheKey(endpointsFor(settings.host).hostKey, activeSource.id);
    return {
      settings,
      activeSource,
      entry: key === null ? undefined : cache?.entries[key],
      sourceState: key === null ? undefined : polling.sources[key],
      polling,
      isCacheLoaded: cache !== null,
      viewerLogin: polling.viewer?.value.login ?? null,
      viewerTeams: polling.viewerTeams?.value ?? null,
    };
  }, [settings, cache, polling]);
};
