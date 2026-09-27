import {
  collectLabels,
  derivePullRequestFlags,
  type FlagContext,
  type Label,
  type PullRequest,
  type PullRequestFlags,
} from '@core/github';
import type { DashboardTab, SortField, TriStateFilter } from '@core/storage';
import { compareBy, matchesSearch, type SortDirection } from '@shared/utils';

export interface DashboardItem {
  pullRequest: PullRequest;
  flags: PullRequestFlags;
}

export interface DashboardQuery {
  tab: DashboardTab;
  draftFilter: TriStateFilter;
  staleFilter: TriStateFilter;
  labelFilter: string | null;
  search: string;
  sortField: SortField;
  sortDirection: SortDirection;
}

export interface AuthorCount {
  login: string;
  count: number;
}

export interface DashboardStats {
  total: number;
  needsReview: number;
  needsMyReview: number;
  mine: number;
  drafts: number;
  stale: number;
  untouched: number;
  conflicts: number;
  checksFailed: number;
}

export interface DashboardView {
  items: DashboardItem[];
  effectiveTab: DashboardTab;
  counts: { all: number; needsReview: number; needsMyReview: number };
  authors: AuthorCount[];
  labels: Label[];
  stats: DashboardStats;
}

export const authorTab = (login: string): DashboardTab => `author:${login}`;
const GHOST = 'ghost';
const authorLogin = (pullRequest: PullRequest): string => pullRequest.author?.login ?? GHOST;

const matchesTriState = (value: boolean, filter: TriStateFilter): boolean =>
  filter === 'all' || (filter === 'only' ? value : !value);

const matchesTab = (item: DashboardItem, tab: DashboardTab): boolean => {
  if (tab === 'all') {
    return true;
  }
  if (tab === 'needs-review') {
    return item.flags.needsReview;
  }
  if (tab === 'needs-my-review') {
    return item.flags.needsMyReview;
  }
  return authorLogin(item.pullRequest).toLowerCase() === tab.slice('author:'.length).toLowerCase();
};

const searchableText = ({ pullRequest }: DashboardItem): string[] => [
  pullRequest.title,
  `${pullRequest.repository.owner}/${pullRequest.repository.name}`,
  `#${pullRequest.number}`,
  authorLogin(pullRequest),
  ...pullRequest.labels.map((label) => label.name),
];

export const computeStats = (items: readonly DashboardItem[]): DashboardStats => {
  const count = (predicate: (flags: PullRequestFlags) => boolean): number =>
    items.filter((item) => predicate(item.flags)).length;
  return {
    total: items.length,
    needsReview: count((flags) => flags.needsReview),
    needsMyReview: count((flags) => flags.needsMyReview),
    mine: count((flags) => flags.isMine),
    drafts: count((flags) => flags.isDraft),
    stale: count((flags) => flags.isStale),
    untouched: count((flags) => flags.isUntouched),
    conflicts: count((flags) => flags.hasConflicts),
    checksFailed: count((flags) => flags.checksFailed),
  };
};

export const buildDashboardView = (
  pullRequests: readonly PullRequest[],
  context: FlagContext,
  query: DashboardQuery,
): DashboardView => {
  const all: DashboardItem[] = pullRequests
    .filter((pullRequest) => pullRequest.state === 'open')
    .map((pullRequest) => ({ pullRequest, flags: derivePullRequestFlags(pullRequest, context) }));

  const authorCounts = new Map<string, AuthorCount>();
  for (const item of all) {
    const login = authorLogin(item.pullRequest);
    const current = authorCounts.get(login.toLowerCase());
    authorCounts.set(login.toLowerCase(), { login, count: (current?.count ?? 0) + 1 });
  }
  const authors = [...authorCounts.values()].sort(
    (left, right) => right.count - left.count || left.login.localeCompare(right.login),
  );

  const isKnownTab =
    !query.tab.startsWith('author:') ||
    authorCounts.has(query.tab.slice('author:'.length).toLowerCase());
  const effectiveTab: DashboardTab = isKnownTab ? query.tab : 'all';
  const labelFilter = query.labelFilter?.toLowerCase() ?? null;

  const items = all
    .filter((item) => matchesTab(item, effectiveTab))
    .filter((item) => matchesTriState(item.flags.isDraft, query.draftFilter))
    .filter((item) => matchesTriState(item.flags.isStale, query.staleFilter))
    .filter(
      (item) =>
        labelFilter === null ||
        item.pullRequest.labels.some((label) => label.name.toLowerCase() === labelFilter),
    )
    .filter((item) => matchesSearch(searchableText(item), query.search))
    .sort(
      compareBy(
        (item) =>
          Date.parse(
            query.sortField === 'created' ? item.pullRequest.createdAt : item.pullRequest.updatedAt,
          ) || 0,
        query.sortDirection,
      ),
    );

  const stats = computeStats(all);
  return {
    items,
    effectiveTab,
    counts: {
      all: stats.total,
      needsReview: stats.needsReview,
      needsMyReview: stats.needsMyReview,
    },
    authors,
    labels: collectLabels(all.map((item) => item.pullRequest.labels)),
    stats,
  };
};
