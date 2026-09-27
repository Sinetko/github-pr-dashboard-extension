import type { SortField, TriStateFilter } from '@core/storage';
import type { SortDirection } from '@shared/utils';

export const TRI_STATE_OPTIONS: readonly { value: TriStateFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'hide', label: 'Hide' },
  { value: 'only', label: 'Only' },
];

export type SortOptionValue = `${SortField}:${SortDirection}`;

export const SORT_OPTIONS: readonly { value: SortOptionValue; label: string }[] = [
  { value: 'updated:desc', label: 'Recently updated' },
  { value: 'updated:asc', label: 'Least recently updated' },
  { value: 'created:desc', label: 'Newest' },
  { value: 'created:asc', label: 'Oldest' },
];

export const ALL_LABELS = '__all__';

export const parseSortOption = (
  value: SortOptionValue,
): { sortField: SortField; sortDirection: SortDirection } => {
  const [field, direction] = value.split(':');
  return {
    sortField: field === 'created' ? 'created' : 'updated',
    sortDirection: direction === 'asc' ? 'asc' : 'desc',
  };
};
