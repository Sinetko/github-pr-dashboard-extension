export type UnknownRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const asRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

export const readString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

export const readNullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

export const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

export const readInteger = (
  value: unknown,
  fallback: number,
  { min, max }: { min: number; max: number },
): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;

export const readEnum = <TValue extends string>(
  value: unknown,
  allowed: readonly TValue[],
  fallback: TValue,
): TValue => allowed.find((candidate) => candidate === value) ?? fallback;

export const readArray = <TItem>(
  value: unknown,
  parseItem: (item: unknown) => TItem | null,
): TItem[] =>
  Array.isArray(value) ? value.map(parseItem).filter((item): item is TItem => item !== null) : [];

export const readRecordOf = <TItem>(
  value: unknown,
  parseItem: (item: unknown) => TItem | null,
): Record<string, TItem> => {
  const result: Record<string, TItem> = {};
  for (const [key, item] of Object.entries(asRecord(value))) {
    const parsed = parseItem(item);
    if (parsed !== null) {
      result[key] = parsed;
    }
  }
  return result;
};
