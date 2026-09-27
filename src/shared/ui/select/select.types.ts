export interface SelectOption<TValue extends string> {
  value: TValue;
  label: string;
}

export interface SelectProps<TValue extends string> {
  id: string;
  label: string;
  hideLabel?: boolean;
  options: readonly SelectOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  disabled?: boolean;
}
