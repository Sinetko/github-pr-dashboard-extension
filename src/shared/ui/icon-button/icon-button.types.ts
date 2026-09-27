import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'aria-label' | 'children'
> {
  label: string;
  icon: ReactNode;
  isActive?: boolean;
}
