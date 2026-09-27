export const openTab = async (url: string): Promise<void> => {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error('Refusing to open a non-https URL');
  }
  await chrome.tabs.create({ url: parsed.href, active: true });
};
