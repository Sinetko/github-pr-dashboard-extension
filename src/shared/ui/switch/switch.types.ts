import type { ReactNode } from 'react';

export interface SwitchProps {
  id: string;
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}
