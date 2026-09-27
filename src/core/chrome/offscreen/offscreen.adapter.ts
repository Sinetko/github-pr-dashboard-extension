export interface OffscreenDocumentOptions {
  path: string;
  justification: string;
}

const ALREADY_EXISTS_PATTERN = /single offscreen document|already exists/i;

export const createOffscreenDocumentManager = ({
  path,
  justification,
}: OffscreenDocumentOptions): { ensure: () => Promise<void> } => {
  let pending: Promise<void> | null = null;

  const create = async (): Promise<void> => {
    if (await chrome.offscreen.hasDocument()) {
      return;
    }
    try {
      await chrome.offscreen.createDocument({
        url: path,
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification,
      });
    } catch (error) {
      if (!(error instanceof Error && ALREADY_EXISTS_PATTERN.test(error.message))) {
        throw error;
      }
    }
  };

  return {
    ensure: () => {
      pending ??= create().finally(() => {
        pending = null;
      });
      return pending;
    },
  };
};
