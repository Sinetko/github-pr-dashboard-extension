import { useCallback, useSyncExternalStore } from 'react';

export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== 'function') {
        return () => undefined;
      }
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener('change', onChange);
      return () => {
        mediaQueryList.removeEventListener('change', onChange);
      };
    },
    [query],
  );
  const getSnapshot = useCallback(
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    [query],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
};
