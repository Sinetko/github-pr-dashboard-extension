import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from '.';

describe('useDebouncedValue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('only emits after the value settles', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' },
    });
    rerender({ value: 'ab' });
    rerender({ value: 'abc' });
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('abc');
  });
});
