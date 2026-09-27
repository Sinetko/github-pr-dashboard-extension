import type { ReactNode } from 'react';

export interface TabPanelProps {
  idPrefix: string;
  value: string;
  children?: ReactNode;
}
