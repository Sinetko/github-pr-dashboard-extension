import type { AppTheme } from '../../theme';
import type { ReactNode } from 'react';

export interface StackProps {
  direction?: 'row' | 'column';
  gap?: keyof AppTheme['space'];
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'space-between';
  wrap?: boolean;
  as?: 'div' | 'section' | 'header' | 'footer' | 'ul' | 'li' | 'form';
  children?: ReactNode;
}
