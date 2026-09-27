import type { Tone } from '../../theme';
import type { ReactNode } from 'react';

export interface PillProps {
  tone?: Tone;
  title?: string;
  leadingVisual?: ReactNode;
  children: ReactNode;
}
