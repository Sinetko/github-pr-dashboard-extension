import { Segment, SegmentGroup } from './segmented-control.styles';

import type { SegmentedControlProps } from './segmented-control.types';
import type { ReactElement } from 'react';

export const SegmentedControl = <TValue extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<TValue>): ReactElement => (
  <SegmentGroup role="radiogroup" aria-label={label}>
    {options.map((option) => (
      <Segment
        key={option.value}
        type="button"
        role="radio"
        aria-checked={option.value === value}
        $isSelected={option.value === value}
        onClick={() => {
          onChange(option.value);
        }}
      >
        {option.label}
      </Segment>
    ))}
  </SegmentGroup>
);
