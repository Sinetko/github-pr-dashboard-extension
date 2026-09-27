export const getExtensionId = (): string => chrome.runtime.id;

export const getExtensionVersion = (): string => chrome.runtime.getManifest().version;

export const getExtensionUrl = (path: string): string => chrome.runtime.getURL(path);

export type InstallReason = 'install' | 'update' | 'other';

export const onLifecycle = (handlers: {
  onInstalled: (reason: InstallReason) => void | Promise<void>;
  onStartup: () => void | Promise<void>;
}): void => {
  const run = (label: string, task: () => void | Promise<void>): void => {
    void Promise.resolve()
      .then(task)
      .catch((error: unknown) => {
        console.error(`${label} handler failed`, error);
      });
  };
  chrome.runtime.onInstalled.addListener((details) => {
    const reason: InstallReason =
      details.reason === 'install' || details.reason === 'update' ? details.reason : 'other';
    run('onInstalled', () => handlers.onInstalled(reason));
  });
  chrome.runtime.onStartup.addListener(() => {
    run('onStartup', handlers.onStartup);
  });
};
