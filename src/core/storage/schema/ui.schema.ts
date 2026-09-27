import type { SortDirection } from '@shared/utils';

import {
  asRecord,
  readArray,
  readBoolean,
  readEnum,
  readNullableString,
  readString,
} from '../validate';

export type TriStateFilter = 'all' | 'hide' | 'only';
export type SortField = 'created' | 'updated';
export type DashboardTab = 'all' | 'needs-review' | 'needs-my-review' | `author:${string}`;

export interface ConfigurationDraft {
  hostInput: string;
  useEnterprise: boolean;
  tokenKind: 'classic' | 'fine-grained';
  sourceInputs: string[];
  searchQuery: string;
  savedAt: string;
}

export interface UiRecord {
  activeTab: DashboardTab;
  draftFilter: TriStateFilter;
  staleFilter: TriStateFilter;
  labelFilter: string | null;
  sortField: SortField;
  sortDirection: SortDirection;
  statsCollapsed: boolean;
  configurationDraft: ConfigurationDraft | null;
}

export const DEFAULT_UI: UiRecord = {
  activeTab: 'all',
  draftFilter: 'all',
  staleFilter: 'all',
  labelFilter: null,
  sortField: 'updated',
  sortDirection: 'desc',
  statsCollapsed: false,
  configurationDraft: null,
};

const TRI_STATE: readonly TriStateFilter[] = ['all', 'hide', 'only'];

const parseTab = (value: unknown): DashboardTab => {
  if (value === 'all' || value === 'needs-review' || value === 'needs-my-review') {
    return value;
  }
  return typeof value === 'string' && /^author:[A-Za-z0-9-_[\]]{1,60}$/.test(value)
    ? (value as `author:${string}`)
    : DEFAULT_UI.activeTab;
};

const parseDraft = (value: unknown): ConfigurationDraft | null => {
  const record = asRecord(value);
  if (typeof record.savedAt !== 'string') {
    return null;
  }
  return {
    hostInput: readString(record.hostInput, ''),
    useEnterprise: readBoolean(record.useEnterprise, false),
    tokenKind: readEnum(record.tokenKind, ['classic', 'fine-grained'] as const, 'fine-grained'),
    sourceInputs: readArray(record.sourceInputs, (item) =>
      typeof item === 'string' ? item : null,
    ),
    searchQuery: readString(record.searchQuery, ''),
    savedAt: record.savedAt,
  };
};

export const parseUi = (value: unknown): UiRecord => {
  const record = asRecord(value);
  return {
    activeTab: parseTab(record.activeTab),
    draftFilter: readEnum(record.draftFilter, TRI_STATE, DEFAULT_UI.draftFilter),
    staleFilter: readEnum(record.staleFilter, TRI_STATE, DEFAULT_UI.staleFilter),
    labelFilter: readNullableString(record.labelFilter),
    sortField: readEnum(record.sortField, ['created', 'updated'] as const, DEFAULT_UI.sortField),
    sortDirection: readEnum(
      record.sortDirection,
      ['asc', 'desc'] as const,
      DEFAULT_UI.sortDirection,
    ),
    statsCollapsed: readBoolean(record.statsCollapsed, DEFAULT_UI.statsCollapsed),
    configurationDraft: parseDraft(record.configurationDraft),
  };
};
