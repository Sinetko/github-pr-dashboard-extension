export interface SegmentedOption<TValue extends string> {
  value: TValue;
  label: string;
}

export interface SegmentedControlProps<TValue extends string> {
  label: string;
  options: readonly SegmentedOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
}
