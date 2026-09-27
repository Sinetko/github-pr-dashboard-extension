import { isSoundId, soundPath } from '@core/audio';
import { onMessage } from '@core/chrome/messaging';
import { getExtensionUrl } from '@core/chrome/runtime';

const audio = new Audio();
audio.preload = 'auto';

onMessage((message) => {
  if (message.type !== 'play-sound' || !isSoundId(message.sound)) {
    return;
  }
  audio.src = getExtensionUrl(soundPath(message.sound));
  audio.currentTime = 0;
  void audio.play().catch((error: unknown) => {
    console.warn('[offscreen] could not play sound', error);
  });
});
