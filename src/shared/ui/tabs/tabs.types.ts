export interface TabItem<TValue extends string> {
  value: TValue;
  label: string;
  count?: number;
}

export interface TabsProps<TValue extends string> {
  items: readonly TabItem<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  label: string;
  idPrefix: string;
}
