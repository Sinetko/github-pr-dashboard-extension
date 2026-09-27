import { panelId, tabId } from '../tabs/tabs.model';

import type { TabPanelProps } from './tab-panel.types';
import type { FC } from 'react';

export const TabPanel: FC<TabPanelProps> = ({ idPrefix, value, children }) => (
  <div role="tabpanel" id={panelId(idPrefix, value)} aria-labelledby={tabId(idPrefix, value)}>
    {children}
  </div>
);
