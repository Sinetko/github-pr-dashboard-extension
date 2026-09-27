export interface BadgeAppearance {
  text: string;
  backgroundColor: string;
  textColor: string;
  title: string;
}

export const setBadge = async ({
  text,
  backgroundColor,
  textColor,
  title,
}: BadgeAppearance): Promise<void> => {
  await Promise.all([
    chrome.action.setBadgeText({ text }),
    chrome.action.setBadgeBackgroundColor({ color: backgroundColor }),
    chrome.action.setBadgeTextColor({ color: textColor }),
    chrome.action.setTitle({ title }),
  ]);
};

export const tryOpenPopup = async (): Promise<boolean> => {
  try {
    await chrome.action.openPopup();
    return true;
  } catch {
    return false;
  }
};
