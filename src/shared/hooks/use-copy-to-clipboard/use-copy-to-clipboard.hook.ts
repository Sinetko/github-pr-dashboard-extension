import { useCallback, useEffect, useRef, useState } from 'react';

export type CopyState = 'idle' | 'copied' | 'failed';

export const useCopyToClipboard = (
  resetAfterMilliseconds = 2000,
): { copy: (text: string) => Promise<boolean>; state: CopyState } => {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const copy = useCallback(
    async (text: string) => {
      let succeeded: boolean;
      try {
        await navigator.clipboard.writeText(text);
        succeeded = true;
      } catch {
        succeeded = false;
      }
      setState(succeeded ? 'copied' : 'failed');
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => {
        setState('idle');
      }, resetAfterMilliseconds);
      return succeeded;
    },
    [resetAfterMilliseconds],
  );

  return { copy, state };
};
