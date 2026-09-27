import type { ExtensionMessage, MessageHandler } from './messaging.types';

const SOUND_MESSAGE_TYPES = new Set(['test-sound', 'play-sound']);
const PLAIN_MESSAGE_TYPES = new Set(['poll-now', 'test-notification', 'unlock-changed']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isExtensionMessage = (value: unknown): value is ExtensionMessage => {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }
  if (PLAIN_MESSAGE_TYPES.has(value.type)) {
    return true;
  }
  return SOUND_MESSAGE_TYPES.has(value.type) && typeof value.sound === 'string';
};

const NO_RECEIVER_PATTERN = /Receiving end does not exist|Could not establish connection/i;

export const sendMessage = async (message: ExtensionMessage): Promise<boolean> => {
  try {
    await chrome.runtime.sendMessage(message);
    return true;
  } catch (error) {
    if (error instanceof Error && NO_RECEIVER_PATTERN.test(error.message)) {
      return false;
    }
    throw error;
  }
};

export const onMessage = (handler: MessageHandler): (() => void) => {
  const listener = (message: unknown, sender: chrome.runtime.MessageSender): undefined => {
    if (sender.id !== chrome.runtime.id || !isExtensionMessage(message)) {
      return undefined;
    }
    void Promise.resolve(handler(message)).catch((error: unknown) => {
      console.error(`Message handler for "${message.type}" failed`, error);
    });
    return undefined;
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => {
    chrome.runtime.onMessage.removeListener(listener);
  };
};
