export type SortDirection = 'asc' | 'desc';

export const compareBy =
  <TItem>(
    selectKey: (item: TItem) => string | number,
    direction: SortDirection = 'asc',
  ): ((left: TItem, right: TItem) => number) =>
  (left, right) => {
    const leftKey = selectKey(left);
    const rightKey = selectKey(right);
    const order =
      typeof leftKey === 'string' && typeof rightKey === 'string'
        ? leftKey.localeCompare(rightKey, undefined, { sensitivity: 'base' })
        : Number(leftKey) - Number(rightKey);
    return direction === 'asc' ? order : -order;
  };

export const matchesSearch = (haystack: readonly string[], query: string): boolean => {
  const needle = query.trim().toLocaleLowerCase();
  return needle === '' || haystack.some((value) => value.toLocaleLowerCase().includes(needle));
};

export const uniqueBy = <TItem>(
  items: readonly TItem[],
  selectKey: (item: TItem) => string,
): TItem[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = selectKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};
