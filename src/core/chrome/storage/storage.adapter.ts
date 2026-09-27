import type { StorageArea, StorageAreaName, StorageChangeListener } from './storage.types';

export const createStorageArea = <TKey extends string>(
  areaName: StorageAreaName,
): StorageArea<TKey> => {
  const area = (): chrome.storage.StorageArea => chrome.storage[areaName];
  return {
    get: async (key) => {
      const result = await area().get(key);
      return result[key];
    },
    getMany: async (keys) => await area().get([...keys]),
    set: (key, value) => area().set({ [key]: value }),
    setMany: (items) => area().set(items),
    remove: (keys) => area().remove(typeof keys === 'string' ? keys : [...keys]),
    subscribe: (key, listener: StorageChangeListener) => {
      const handleChange = (
        changes: Record<string, chrome.storage.StorageChange>,
        changedArea: string,
      ): void => {
        const change = changes[key];
        if (changedArea === areaName && change !== undefined) {
          listener(change.newValue, change.oldValue);
        }
      };
      const { onChanged } = chrome.storage;
      onChanged.addListener(handleChange);
      return () => {
        onChanged.removeListener(handleChange);
      };
    },
  };
};
