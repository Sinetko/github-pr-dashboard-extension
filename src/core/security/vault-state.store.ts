import { createStore, type StoreApi } from 'zustand/vanilla';

import type { TokenVault, VaultStatus } from './token-vault.service';

export interface VaultState {
  isLoaded: boolean;
  status: VaultStatus;
  hasToken: boolean;
  hasBiometric: boolean;
}

export interface VaultStateStore {
  store: StoreApi<VaultState>;
  refresh: () => Promise<void>;
  dispose: () => void;
}

export const createVaultStateStore = (
  vault: Pick<TokenVault, 'getStatus' | 'hasToken' | 'hasBiometric'>,
  subscribeToChanges: readonly ((listener: () => void) => () => void)[],
): VaultStateStore => {
  const store = createStore<VaultState>()(() => ({
    isLoaded: false,
    status: 'locked',
    hasToken: false,
    hasBiometric: false,
  }));
  let generation = 0;
  const refresh = async (): Promise<void> => {
    generation += 1;
    const current = generation;
    const [status, hasToken, hasBiometric] = await Promise.all([
      vault.getStatus(),
      vault.hasToken(),
      vault.hasBiometric(),
    ]);
    if (current === generation) {
      store.setState({ isLoaded: true, status, hasToken, hasBiometric });
    }
  };
  const unsubscribers = subscribeToChanges.map((subscribe) =>
    subscribe(() => {
      void refresh();
    }),
  );
  return {
    store,
    refresh,
    dispose: () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    },
  };
};
