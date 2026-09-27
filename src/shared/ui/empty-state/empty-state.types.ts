import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  visual?: ReactNode;
}
