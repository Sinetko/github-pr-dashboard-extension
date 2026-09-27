import type { Label } from '@core/github';
import type { SortField, TriStateFilter } from '@core/storage';
import type { SortDirection } from '@shared/utils';

export interface FilterBarProps {
  search: string;
  onSearchChange: (search: string) => void;
  draftFilter: TriStateFilter;
  staleFilter: TriStateFilter;
  labelFilter: string | null;
  labels: readonly Label[];
  sortField: SortField;
  sortDirection: SortDirection;
  onChange: (patch: {
    draftFilter?: TriStateFilter;
    staleFilter?: TriStateFilter;
    labelFilter?: string | null;
    sortField?: SortField;
    sortDirection?: SortDirection;
  }) => void;
}
