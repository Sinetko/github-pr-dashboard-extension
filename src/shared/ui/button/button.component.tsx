import { Spinner } from '../spinner';
import { StyledButton } from './button.styles';

import type { ButtonProps } from './button.types';
import type { FC } from 'react';

export const Button: FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  isLoading = false,
  fullWidth = false,
  leadingVisual,
  disabled,
  children,
  ...rest
}) => (
  <StyledButton
    {...rest}
    type={type}
    $variant={variant}
    $size={size}
    $fullWidth={fullWidth}
    disabled={disabled === true || isLoading}
    aria-busy={isLoading || undefined}
  >
    {isLoading ? <Spinner size="sm" label="" /> : leadingVisual}
    {children}
  </StyledButton>
);
