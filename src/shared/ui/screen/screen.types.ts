import type { ReactNode } from 'react';

export interface ScreenProps {
  title: string;
  description?: ReactNode;
  headerAction?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}
