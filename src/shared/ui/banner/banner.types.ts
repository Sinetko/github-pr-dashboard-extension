import type { Tone } from '../../theme';
import type { ReactNode } from 'react';

export interface BannerProps {
  tone?: Tone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}
