import { vi } from 'vitest';

export const installMatchMedia = (initialMatches: boolean): ((matches: boolean) => void) => {
  let matches = initialMatches;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    })),
  );
  return (nextMatches: boolean) => {
    matches = nextMatches;
    for (const listener of listeners) {
      listener();
    }
  };
};
