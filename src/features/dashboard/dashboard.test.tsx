import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PullRequest, PullRequestFlags } from '@core/github';
import {
  createLocalRepositories,
  createPersistedStore,
  DEFAULT_POLLING,
  DEFAULT_SETTINGS,
  type PollingRecord,
  type SettingsRecord,
  type UiRecord,
} from '@core/storage';
import { installChromeFake, type ChromeFake } from '@test/chrome-fake';
import { renderWithTheme } from '@test/render';

import { DashboardScreen } from '.';
import { approvalLabel, statusPills } from './components/pull-request-item';

import type { DashboardServices } from './model/dashboard-services.types';

let chromeFake: ChromeFake;

const SETTINGS: SettingsRecord = {
  ...DEFAULT_SETTINGS,
  sources: [
    { id: 'repo:octo-org/hello-world', kind: 'repository', owner: 'octo-org', name: 'hello-world' },
    { id: 'search:is:open', kind: 'search', label: 'Saved search', query: 'is:open' },
  ],
  activeSourceId: 'repo:octo-org/hello-world',
};
const KEY = 'github.com|repo:octo-org/hello-world';
const SEARCH_KEY = 'github.com|search:is:open';

let counter = 0;
const pr = (overrides: Partial<PullRequest> = {}): PullRequest => {
  counter += 1;
  const now = Date.now();
  return {
    id: `github.com:octo-org/hello-world#${counter}`,
    nodeId: `PR_${counter}`,
    repository: { owner: 'octo-org', name: 'hello-world' },
    number: counter,
    title: `Change number ${counter}`,
    htmlUrl: `https://github.com/octo-org/hello-world/pull/${counter}`,
    author: { login: 'mona', avatarUrl: '' },
    state: 'open',
    isDraftNative: false,
    createdAt: new Date(now - 3 * 86_400_000).toISOString(),
    updatedAt: new Date(now - 3_600_000).toISOString(),
    lastActivityAt: new Date(now - 3_600_000).toISOString(),
    headRefOid: 'abc',
    baseRefName: 'main',
    labels: [],
    requestedReviewers: [],
    latestReviews: [],
    lastReview: null,
    lastComment: null,
    requiredApprovals: null,
    checks: 'success',
    mergeability: 'mergeable',
    mergeState: 'clean',
    commentCount: 1,
    reviewCount: 1,
    unresolvedThreadCount: 0,
    ...overrides,
  };
};

const seed = async ({
  pullRequests,
  polling = {},
  settings = SETTINGS,
  ui = {},
  extraEntries = {},
}: {
  pullRequests?: PullRequest[];
  polling?: Partial<PollingRecord>;
  settings?: SettingsRecord;
  ui?: Partial<UiRecord>;
  extraEntries?: Record<string, PullRequest[]>;
}): Promise<DashboardServices> => {
  const repositories = createLocalRepositories();
  await repositories.settings.write(settings);
  await repositories.ui.update((current) => ({ ...current, ...ui }));
  await repositories.polling.write({
    ...DEFAULT_POLLING,
    viewer: { value: { login: 'me', avatarUrl: '' }, fetchedAt: 't' },
    ...polling,
  });
  const entries = Object.fromEntries(
    Object.entries({
      ...(pullRequests === undefined ? {} : { [KEY]: pullRequests }),
      ...extraEntries,
    }).map(([key, value]) => [
      key,
      { fetchedAt: new Date().toISOString(), pullRequests: value, truncated: false },
    ]),
  );
  await repositories.cache.write({ entries });
  const settingsStore = createPersistedStore(repositories.settings);
  const uiStore = createPersistedStore(repositories.ui);
  await Promise.all([settingsStore.hydrate(), uiStore.hydrate()]);
  return {
    settings: settingsStore,
    ui: uiStore,
    cache: repositories.cache,
    polling: repositories.polling,
    openTab: vi.fn(() => Promise.resolve()),
    sendMessage: vi.fn(() => Promise.resolve(true)),
  };
};

const renderDashboard = (
  services: DashboardServices,
  callbacks = { onOpenSettings: vi.fn(), onOpenAbout: vi.fn() },
) => {
  renderWithTheme(<DashboardScreen services={services} {...callbacks} />);
  return callbacks;
};

const listItems = (): HTMLElement[] =>
  within(screen.getByRole('list', { name: 'Pull requests' })).getAllByRole('link');

beforeEach(() => {
  chromeFake = installChromeFake();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DashboardScreen', () => {
  it('shows a spinner until the first fetch lands, and asks for a silent refresh on open', async () => {
    const services = await seed({});
    renderDashboard(services);
    expect(
      await screen.findByRole('status', { name: 'Fetching pull requests' }),
    ).toBeInTheDocument();
    expect(services.sendMessage).toHaveBeenCalledWith({ type: 'poll-now' });
    await act(async () => {
      await createLocalRepositories().cache.write({
        entries: {
          [KEY]: {
            fetchedAt: new Date().toISOString(),
            pullRequests: [pr({ title: 'Arrived' })],
            truncated: false,
          },
        },
      });
    });
    expect(await screen.findByText('Arrived')).toBeInTheDocument();
  });

  it('renders PRs with status pills and opens them in a tab', async () => {
    const services = await seed({
      pullRequests: [
        pr({
          title: 'Please review',
          requestedReviewers: [{ kind: 'user', login: 'me' }],
          mergeability: 'conflicting',
          checks: 'failure',
          unresolvedThreadCount: 2,
          requiredApprovals: 2,
          latestReviews: [{ login: 'x', state: 'approved', submittedAt: 't', commitOid: 'abc' }],
          labels: [{ name: 'bug', color: 'd73a4a', description: null }],
        }),
      ],
    });
    renderDashboard(services);
    const item = await screen.findByRole('link', { name: /Please review/ });
    for (const text of [
      'Needs my review',
      'Conflicts',
      'Checks failing',
      '✓ 1/2 approved',
      '💬 2 unresolved',
      'bug',
    ]) {
      expect(within(item).getByText(text)).toBeInTheDocument();
    }
    expect(within(item).getByText(/opened 3 days ago · updated 1 hour ago/)).toBeInTheDocument();
    await userEvent.click(item);
    expect(services.openTab).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/github\.com\/octo-org\/hello-world\/pull\/\d+$/),
    );
  });

  it('counts and switches tabs (persisted), including per-author tabs', async () => {
    const services = await seed({
      pullRequests: [
        pr({ requestedReviewers: [{ kind: 'user', login: 'me' }] }),
        pr({
          requestedReviewers: [{ kind: 'user', login: 'hubot' }],
          author: { login: 'hubot', avatarUrl: '' },
        }),
        pr(),
      ],
    });
    renderDashboard(services);
    expect(await screen.findByRole('tab', { name: 'All (3)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Needs review (2)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Needs my review (1)' }));
    expect(listItems()).toHaveLength(1);
    await waitFor(() => {
      expect((chromeFake.chrome.storage.local.data.get('ui') as UiRecord).activeTab).toBe(
        'needs-my-review',
      );
    });
    await userEvent.click(screen.getByRole('tab', { name: 'hubot (1)' }));
    expect(listItems()).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'mona (2)' })).toBeInTheDocument();
  });

  it('searches live and filters drafts, with a clear-filters escape hatch', async () => {
    const services = await seed({
      pullRequests: [
        pr({ title: 'Fix login flow' }),
        pr({ title: 'WIP: new parser' }),
        pr({ title: 'Docs' }),
      ],
    });
    renderDashboard(services);
    await userEvent.type(
      await screen.findByRole('searchbox', { name: 'Search pull requests' }),
      'LOGIN',
    );
    await waitFor(() => {
      expect(listItems()).toHaveLength(1);
    });
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search pull requests' }));
    await userEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Draft filter' })).getByRole('radio', {
        name: 'Only',
      }),
    );
    await waitFor(() => {
      expect(listItems()).toHaveLength(1);
    });
    expect(screen.getByText('WIP: new parser')).toBeInTheDocument();
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search pull requests' }),
      'nomatch',
    );
    expect(
      await screen.findByRole('heading', { name: 'No pull requests match' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => {
      expect(listItems()).toHaveLength(3);
    });
  });

  it('shows an empty state for a source with no open PRs, and persists stats collapse', async () => {
    const services = await seed({ pullRequests: [] });
    renderDashboard(services);
    expect(
      await screen.findByRole('heading', { name: 'No open pull requests' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Overview/ }));
    await waitFor(() => {
      expect((chromeFake.chrome.storage.local.data.get('ui') as UiRecord).statsCollapsed).toBe(
        true,
      );
    });
  });

  it('switches sources cache-first (no empty flash) and requests a refresh', async () => {
    const services = await seed({
      pullRequests: [pr({ title: 'Repo PR' })],
      extraEntries: { [SEARCH_KEY]: [pr({ title: 'Search PR' })] },
    });
    renderDashboard(services);
    expect(await screen.findByText('Repo PR')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Source'), 'Search: is:open');
    expect(await screen.findByText('Search PR')).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: 'Fetching pull requests' }),
    ).not.toBeInTheDocument();
    expect(
      (chromeFake.chrome.storage.local.data.get('settings') as SettingsRecord).activeSourceId,
    ).toBe('search:is:open');
  });

  it('shows rate-limit, invalid-token and refresh-error banners', async () => {
    const future = new Date(Date.now() + 30 * 60_000).toISOString();
    const rateLimited = await seed({ pullRequests: [pr()], polling: { rateLimitedUntil: future } });
    renderDashboard(rateLimited);
    expect(
      await screen.findByText(/Rate limited by GitHub — resuming at \d\d:\d\d/),
    ).toBeInTheDocument();
  });

  it('routes an invalid token to settings', async () => {
    const services = await seed({
      pullRequests: [pr()],
      polling: { lastError: { kind: 'unauthorized', message: 'x', at: 't' } },
    });
    const callbacks = renderDashboard(services);
    await userEvent.click(await screen.findByRole('button', { name: 'Update token' }));
    expect(callbacks.onOpenSettings).toHaveBeenCalledOnce();
  });

  it('keeps cached data visible when a refresh fails, with retry', async () => {
    const services = await seed({
      pullRequests: [pr({ title: 'Still here' })],
      polling: {
        sources: {
          [KEY]: {
            etag: null,
            lastFullFetchAt: null,
            lastFetchAt: null,
            cyclesSinceFull: 0,
            lastError: { kind: 'network', message: 'Could not reach GitHub.', at: 't' },
          },
        },
      },
    });
    renderDashboard(services);
    expect(await screen.findByText("Couldn't refresh")).toBeInTheDocument();
    expect(screen.getByText('Still here')).toBeInTheDocument();
    vi.mocked(services.sendMessage).mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(services.sendMessage).toHaveBeenCalledWith({ type: 'poll-now' });
  });

  it('opens About and Settings from the header', async () => {
    const services = await seed({
      pullRequests: [pr()],
      settings: { ...SETTINGS, sources: SETTINGS.sources.slice(0, 1) },
    });
    const callbacks = renderDashboard(services);
    expect(
      await screen.findByRole('heading', { name: 'octo-org/hello-world' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'About' }));
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(callbacks.onOpenAbout).toHaveBeenCalledOnce();
    expect(callbacks.onOpenSettings).toHaveBeenCalledOnce();
  });
});

describe('pull request item model', () => {
  const flags: PullRequestFlags = {
    isDraft: false,
    isStale: false,
    isUntouched: false,
    hasConflicts: false,
    checksFailed: false,
    needsReview: true,
    needsMyReview: false,
    isMine: false,
    approvals: { approved: 0, required: null },
  };

  it('prefers needs-my-review over needs-review and shows pending checks', () => {
    expect(statusPills(flags, 'pending').map((pill) => pill.key)).toEqual(['review', 'pending']);
    expect(
      statusPills(
        { ...flags, needsMyReview: true, isDraft: true, isStale: true, isUntouched: true },
        'success',
      ).map((pill) => pill.key),
    ).toEqual(['my-review', 'draft', 'untouched', 'stale']);
  });

  it('formats approval progress with and without a denominator', () => {
    expect(approvalLabel({ approved: 0, required: null })).toBeNull();
    expect(approvalLabel({ approved: 2, required: null })).toBe('2 approved');
    expect(approvalLabel({ approved: 1, required: 2 })).toBe('1/2 approved');
    expect(approvalLabel({ approved: 0, required: 0 })).toBeNull();
  });
});
