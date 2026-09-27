export const tabId = (idPrefix: string, value: string): string => `${idPrefix}-tab-${value}`;
export const panelId = (idPrefix: string, value: string): string => `${idPrefix}-panel-${value}`;

export const nextTabIndex = (key: string, current: number, total: number): number | null => {
  switch (key) {
    case 'ArrowRight':
      return (current + 1) % total;
    case 'ArrowLeft':
      return (current - 1 + total) % total;
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return null;
  }
};
