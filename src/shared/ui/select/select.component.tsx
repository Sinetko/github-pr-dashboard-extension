import { useCallback, type ChangeEvent, type ReactElement } from 'react';

import { NativeSelect, SelectField, SelectLabel } from './select.styles';

import type { SelectProps } from './select.types';

export const Select = <TValue extends string>({
  id,
  label,
  hideLabel = false,
  options,
  value,
  onChange,
  disabled,
}: SelectProps<TValue>): ReactElement => {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const selected = options.find((option) => option.value === event.target.value);
      if (selected !== undefined) {
        onChange(selected.value);
      }
    },
    [options, onChange],
  );
  return (
    <SelectField>
      <SelectLabel htmlFor={id} $isHidden={hideLabel}>
        {label}
      </SelectLabel>
      <NativeSelect id={id} value={value} onChange={handleChange} disabled={disabled}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </SelectField>
  );
};
