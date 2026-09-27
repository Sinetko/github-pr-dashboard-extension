import type { Label } from '../domain/pull-request.types';

interface RawLabel {
  name: string;
  color?: string | null;
  description?: string | null;
}

const HEX_COLOR = /^[0-9a-f]{6}$/i;
export const DEFAULT_LABEL_COLOR = 'ededed';

export const normalizeLabels = (labels: readonly (RawLabel | null | undefined)[]): Label[] => {
  const seen = new Set<string>();
  const result: Label[] = [];
  for (const label of labels) {
    const name = label?.name.trim() ?? '';
    const key = name.toLocaleLowerCase();
    if (label === null || label === undefined || name === '' || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const color = label.color?.replace(/^#/, '') ?? '';
    const description = label.description?.trim() ?? '';
    result.push({
      name,
      color: HEX_COLOR.test(color) ? color.toLowerCase() : DEFAULT_LABEL_COLOR,
      description: description === '' ? null : description,
    });
  }
  return result;
};

export const collectLabels = (labelLists: readonly (readonly Label[])[]): Label[] =>
  normalizeLabels(labelLists.flat()).sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  );
