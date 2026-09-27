import { useCallback, useEffect, useMemo, useState, type FC, type ReactNode } from 'react';
import { useStore } from 'zustand';

import type { DashboardTab, UiRecord } from '@core/storage';
import { useDebouncedValue, useNow } from '@shared/hooks';
import { Button, EmptyState, IconButton, Select, Spinner, TabPanel, Tabs } from '@shared/ui';

import { useDashboardData } from '../../hooks/use-dashboard-data';
import { resolveDashboardStatus } from '../../model/dashboard-status.model';
import { buildDashboardView } from '../../model/dashboard-view.model';
import { FilterBar } from '../filter-bar';
import { PullRequestList } from '../pull-request-list';
import { StatsSection } from '../stats-section';
import { StatusBanner } from '../status-banner';
import { DASHBOARD_ID_PREFIX, sourceLabel, tabItems } from './dashboard-screen.model';
import {
  Centered,
  DashboardRoot,
  Header,
  HeaderTitle,
  SourceSlot,
  TabsSlot,
} from './dashboard-screen.styles';

import type { DashboardScreenProps } from './dashboard-screen.types';

const SEARCH_DEBOUNCE_MILLISECONDS = 120;

export const DashboardScreen: FC<DashboardScreenProps> = ({
  services,
  onOpenSettings,
  onOpenAbout,
}) => {
  const data = useDashboardData(services);
  const ui = useStore(services.ui.store, (state) => state.value);
  const now = useNow();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MILLISECONDS);

  useEffect(() => {
    void services.sendMessage({ type: 'poll-now' });
  }, [services]);

  const updateUi = useCallback(
    (patch: Partial<UiRecord>) => {
      void services.ui.update((current) => ({ ...current, ...patch }));
    },
    [services],
  );

  const view = useMemo(
    () =>
      buildDashboardView(
        data.entry?.pullRequests ?? [],
        {
          viewerLogin: data.viewerLogin ?? '',
          viewerTeams: data.viewerTeams,
          staleThresholdDays: data.settings.staleThresholdDays,
          now,
        },
        {
          tab: ui.activeTab,
          draftFilter: ui.draftFilter,
          staleFilter: ui.staleFilter,
          labelFilter: ui.labelFilter,
          search: debouncedSearch,
          sortField: ui.sortField,
          sortDirection: ui.sortDirection,
        },
      ),
    [data, ui, debouncedSearch, now],
  );

  const status = useMemo(
    () =>
      resolveDashboardStatus({
        entry: data.entry,
        sourceState: data.sourceState,
        polling: data.polling,
        now,
      }),
    [data, now],
  );

  const sourceOptions = useMemo(
    () => data.settings.sources.map((source) => ({ value: source.id, label: sourceLabel(source) })),
    [data.settings.sources],
  );

  const selectSource = useCallback(
    (sourceId: string) => {
      void services.settings.update((settings) => ({ ...settings, activeSourceId: sourceId }));
      void services.sendMessage({ type: 'poll-now' });
    },
    [services],
  );
  const refresh = useCallback(() => {
    void services.sendMessage({ type: 'poll-now' });
  }, [services]);
  const openPullRequest = useCallback(
    (url: string) => {
      void services.openTab(url);
    },
    [services],
  );
  const selectTab = useCallback(
    (tab: DashboardTab) => {
      updateUi({ activeTab: tab });
    },
    [updateUi],
  );
  const toggleStats = useCallback(
    (isOpen: boolean) => {
      updateUi({ statsCollapsed: !isOpen });
    },
    [updateUi],
  );

  const renderBody = (): ReactNode => {
    if (data.entry === undefined) {
      return status.kind === 'error' ||
        status.kind === 'token-invalid' ||
        status.kind === 'rate-limited' ? null : (
        <Centered>
          <Spinner size="lg" label="Fetching pull requests" />
        </Centered>
      );
    }
    if (view.counts.all === 0) {
      return (
        <EmptyState title="No open pull requests" description="Nothing to review here right now." />
      );
    }
    if (view.items.length === 0) {
      return (
        <EmptyState
          title="No pull requests match"
          description="Try clearing the search or filters."
          action={
            <Button
              size="sm"
              onClick={() => {
                setSearch('');
                updateUi({ draftFilter: 'all', staleFilter: 'all', labelFilter: null });
              }}
            >
              Clear filters
            </Button>
          }
        />
      );
    }
    return <PullRequestList items={view.items} now={now} onOpen={openPullRequest} />;
  };

  if (!data.isCacheLoaded) {
    return (
      <Centered>
        <Spinner size="lg" />
      </Centered>
    );
  }

  return (
    <DashboardRoot aria-label="Dashboard">
      <Header>
        {sourceOptions.length > 1 && data.activeSource !== null ? (
          <SourceSlot>
            <Select
              id="source"
              label="Source"
              hideLabel
              options={sourceOptions}
              value={data.activeSource.id}
              onChange={selectSource}
            />
          </SourceSlot>
        ) : (
          <HeaderTitle
            title={data.activeSource === null ? undefined : sourceLabel(data.activeSource)}
          >
            {data.activeSource === null ? 'Pull requests' : sourceLabel(data.activeSource)}
          </HeaderTitle>
        )}
        <IconButton label="Refresh" icon="↻" onClick={refresh} />
        <IconButton label="About" icon="ⓘ" onClick={onOpenAbout} />
        <IconButton label="Settings" icon="⚙" onClick={onOpenSettings} />
      </Header>
      <StatusBanner status={status} onOpenSettings={onOpenSettings} onRetry={refresh} />
      {data.entry === undefined ? null : (
        <>
          <StatsSection stats={view.stats} isCollapsed={ui.statsCollapsed} onToggle={toggleStats} />
          <TabsSlot>
            <Tabs
              items={tabItems(view)}
              value={view.effectiveTab}
              onChange={selectTab}
              label="Pull request views"
              idPrefix={DASHBOARD_ID_PREFIX}
            />
          </TabsSlot>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            draftFilter={ui.draftFilter}
            staleFilter={ui.staleFilter}
            labelFilter={ui.labelFilter}
            labels={view.labels}
            sortField={ui.sortField}
            sortDirection={ui.sortDirection}
            onChange={updateUi}
          />
        </>
      )}
      <TabPanel idPrefix={DASHBOARD_ID_PREFIX} value={view.effectiveTab}>
        {renderBody()}
      </TabPanel>
    </DashboardRoot>
  );
};
