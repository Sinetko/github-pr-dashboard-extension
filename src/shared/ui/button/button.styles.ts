import styled, { css } from 'styled-components';

import type { ButtonSize, ButtonVariant } from './button.types';

interface StyledButtonProps {
  $variant: ButtonVariant;
  $size: ButtonSize;
  $fullWidth: boolean;
}

export const StyledButton = styled.button<StyledButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space.xs};
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  padding: ${({ theme, $size }) =>
    $size === 'sm'
      ? `${theme.space.xxs} ${theme.space.sm}`
      : `${theme.space.xs} ${theme.space.md}`};
  min-height: ${({ $size }) => ($size === 'sm' ? '26px' : '32px')};
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme, $size }) => ($size === 'sm' ? theme.font.size.sm : theme.font.size.md)};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;
  transition: background-color ${({ theme }) => theme.motion.fast};
  white-space: nowrap;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  ${({ theme, $variant }) => {
    const { colors } = theme;
    switch ($variant) {
      case 'primary':
        return css`
          background: ${colors.tones.success.foreground};
          color: ${colors.textOnEmphasis};
          &:hover:not(:disabled) {
            filter: brightness(1.08);
          }
        `;
      case 'danger':
        return css`
          background: ${colors.surface};
          border-color: ${colors.border};
          color: ${colors.tones.danger.foreground};
          &:hover:not(:disabled) {
            background: ${colors.tones.danger.subtle};
          }
        `;
      case 'ghost':
        return css`
          background: transparent;
          color: ${colors.text};
          &:hover:not(:disabled) {
            background: ${colors.surfaceHover};
          }
        `;
      case 'secondary':
        return css`
          background: ${colors.surface};
          border-color: ${colors.border};
          color: ${colors.text};
          &:hover:not(:disabled) {
            background: ${colors.surfaceHover};
          }
        `;
    }
  }}
`;
