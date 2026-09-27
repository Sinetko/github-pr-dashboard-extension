import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSessionRepositories } from '@core/storage';
import { installChromeFake } from '@test/chrome-fake';

import { promptUnlockOnce } from '.';

beforeEach(() => {
  installChromeFake();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('promptUnlockOnce', () => {
  it('opens the popup once per session', async () => {
    const deps = {
      lockedPromptShown: createSessionRepositories().lockedPromptShown,
      tryOpenPopup: vi.fn(() => Promise.resolve(true)),
      showNotification: vi.fn(() => Promise.resolve()),
    };
    expect(await promptUnlockOnce(deps)).toBe('popup');
    expect(await promptUnlockOnce(deps)).toBe('already-shown');
    expect(deps.tryOpenPopup).toHaveBeenCalledOnce();
    expect(deps.showNotification).not.toHaveBeenCalled();
  });

  it('falls back to a notification when the popup cannot open', async () => {
    const deps = {
      lockedPromptShown: createSessionRepositories().lockedPromptShown,
      tryOpenPopup: vi.fn(() => Promise.resolve(false)),
      showNotification: vi.fn(() => Promise.resolve()),
    };
    expect(await promptUnlockOnce(deps)).toBe('notification');
    expect(deps.showNotification).toHaveBeenCalledWith(
      'unlock',
      expect.objectContaining({ title: 'PR Dashboard is locked', requireInteraction: true }),
    );
  });
});
