import { createStore, type StoreApi } from 'zustand/vanilla';

import type { Repository } from './repositories';

export interface PersistedState<TValue> {
  value: TValue;
  isHydrated: boolean;
}

export interface PersistedStore<TValue> {
  store: StoreApi<PersistedState<TValue>>;
  hydrate: () => Promise<void>;
  update: (updater: (current: TValue) => TValue) => Promise<void>;
  dispose: () => void;
}

export const createPersistedStore = <TValue>(
  repository: Repository<TValue>,
): PersistedStore<TValue> => {
  const store = createStore<PersistedState<TValue>>()(() => ({
    value: structuredClone(repository.defaults),
    isHydrated: false,
  }));
  let unsubscribe: (() => void) | null = null;

  return {
    store,
    hydrate: async () => {
      unsubscribe ??= repository.subscribe((value) => {
        store.setState({ value, isHydrated: true });
      });
      const value = await repository.read();
      store.setState({ value, isHydrated: true });
    },
    update: async (updater) => {
      const previous = store.getState().value;
      store.setState((state) => ({ value: updater(state.value) }));
      try {
        const persisted = await repository.update(updater);
        store.setState({ value: persisted, isHydrated: true });
      } catch (error) {
        store.setState({ value: previous });
        throw error;
      }
    },
    dispose: () => {
      unsubscribe?.();
      unsubscribe = null;
    },
  };
};
