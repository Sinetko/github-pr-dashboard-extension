export type StorageAreaName = 'local' | 'session';

export type StorageChangeListener = (newValue: unknown, oldValue: unknown) => void;

export interface StorageArea<TKey extends string> {
  get: (key: TKey) => Promise<unknown>;
  getMany: (keys: readonly TKey[]) => Promise<Partial<Record<TKey, unknown>>>;
  set: (key: TKey, value: unknown) => Promise<void>;
  setMany: (items: Partial<Record<TKey, unknown>>) => Promise<void>;
  remove: (keys: TKey | readonly TKey[]) => Promise<void>;
  subscribe: (key: TKey, listener: StorageChangeListener) => () => void;
}
