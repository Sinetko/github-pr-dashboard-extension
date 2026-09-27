import type { ReactNode } from 'react';

export interface CollapsibleProps {
  id: string;
  title: ReactNode;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  children?: ReactNode;
}
