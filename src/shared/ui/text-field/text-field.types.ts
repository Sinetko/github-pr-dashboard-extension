import type { InputHTMLAttributes, ReactNode } from 'react';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'size'> {
  id: string;
  label: string;
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: string | null;
  trailingAction?: ReactNode;
}
