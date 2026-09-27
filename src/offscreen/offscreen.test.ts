import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installChromeFake, type ChromeFake } from '@test/chrome-fake';

let chromeFake: ChromeFake;
const play = vi.fn(() => Promise.resolve());

class AudioFake {
  src = '';
  currentTime = 0;
  preload = '';
  play = play;
}

beforeEach(() => {
  chromeFake = installChromeFake();
  vi.stubGlobal('Audio', AudioFake);
  play.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('offscreen audio document', () => {
  it('plays only known sounds requested by this extension', async () => {
    vi.resetModules();
    await import('./main');
    const sender = { id: chromeFake.chrome.runtime.id };
    chromeFake.chrome.runtime.onMessage.dispatch(
      { type: 'play-sound', sound: 'ping' },
      sender,
      () => undefined,
    );
    chromeFake.chrome.runtime.onMessage.dispatch(
      { type: 'play-sound', sound: '../../etc/passwd' },
      sender,
      () => undefined,
    );
    chromeFake.chrome.runtime.onMessage.dispatch({ type: 'poll-now' }, sender, () => undefined);
    chromeFake.chrome.runtime.onMessage.dispatch(
      { type: 'play-sound', sound: 'bell' },
      { id: 'someone-else' },
      () => undefined,
    );
    await vi.waitFor(() => {
      expect(play).toHaveBeenCalledOnce();
    });
  });
});
