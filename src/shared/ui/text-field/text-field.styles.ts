import styled from 'styled-components';

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.xs};
`;

export const Label = styled.label<{ $isHidden: boolean }>`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.bold};
  ${({ $isHidden }) =>
    $isHidden
      ? 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;'
      : ''}
`;

export const InputRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.xs};
`;

export const Input = styled.input<{ $hasError: boolean }>`
  flex: 1;
  min-width: 0;
  min-height: 32px;
  padding: ${({ theme }) => `${theme.space.xs} ${theme.space.sm}`};
  border: 1px solid
    ${({ theme, $hasError }) => ($hasError ? theme.colors.tones.danger.foreground : theme.colors.border)};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.background};
  font-size: ${({ theme }) => theme.font.size.md};

  &::placeholder {
    color: ${({ theme }) => theme.colors.textMuted};
  }
  &:focus-visible {
    outline-offset: -1px;
  }
`;

export const Hint = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export const ErrorText = styled.div`
  color: ${({ theme }) => theme.colors.tones.danger.foreground};
  font-size: ${({ theme }) => theme.font.size.sm};
`;
