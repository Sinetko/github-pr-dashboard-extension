import styled from 'styled-components';

export const StyledIconButton = styled.button<{ $isActive: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme, $isActive }) => ($isActive ? theme.colors.surfaceHover : 'transparent')};
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme }) => theme.colors.text};
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`;
