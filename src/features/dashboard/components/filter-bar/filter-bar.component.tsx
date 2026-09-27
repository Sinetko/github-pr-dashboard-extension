import { useMemo, type FC } from 'react';

import { SegmentedControl, Select, TextField } from '@shared/ui';

import {
  ALL_LABELS,
  parseSortOption,
  SORT_OPTIONS,
  TRI_STATE_OPTIONS,
  type SortOptionValue,
} from './filter-bar.model';
import { FilterLabel, FilterRoot, FilterRow } from './filter-bar.styles';

import type { FilterBarProps } from './filter-bar.types';

export const FilterBar: FC<FilterBarProps> = ({
  search,
  onSearchChange,
  draftFilter,
  staleFilter,
  labelFilter,
  labels,
  sortField,
  sortDirection,
  onChange,
}) => {
  const labelOptions = useMemo(
    () => [
      { value: ALL_LABELS, label: 'All labels' },
      ...labels.map((label) => ({ value: label.name, label: label.name })),
    ],
    [labels],
  );
  const activeLabel =
    labelFilter !== null && labels.some((label) => label.name === labelFilter)
      ? labelFilter
      : ALL_LABELS;

  return (
    <FilterRoot>
      <TextField
        id="pull-request-search"
        label="Search pull requests"
        hideLabel
        type="search"
        placeholder="Search title, repo, author, label…"
        value={search}
        onChange={(event) => {
          onSearchChange(event.target.value);
        }}
      />
      <FilterRow>
        <FilterLabel>Drafts</FilterLabel>
        <SegmentedControl
          label="Draft filter"
          options={TRI_STATE_OPTIONS}
          value={draftFilter}
          onChange={(value) => {
            onChange({ draftFilter: value });
          }}
        />
        <FilterLabel>Stale</FilterLabel>
        <SegmentedControl
          label="Stale filter"
          options={TRI_STATE_OPTIONS}
          value={staleFilter}
          onChange={(value) => {
            onChange({ staleFilter: value });
          }}
        />
      </FilterRow>
      <FilterRow>
        <Select
          id="label-filter"
          label="Label"
          hideLabel
          options={labelOptions}
          value={activeLabel}
          onChange={(value) => {
            onChange({ labelFilter: value === ALL_LABELS ? null : value });
          }}
        />
        <Select<SortOptionValue>
          id="sort-order"
          label="Sort"
          hideLabel
          options={SORT_OPTIONS}
          value={`${sortField}:${sortDirection}`}
          onChange={(value) => {
            onChange(parseSortOption(value));
          }}
        />
      </FilterRow>
    </FilterRoot>
  );
};
