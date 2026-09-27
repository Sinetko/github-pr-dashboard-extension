import styled from 'styled-components';

export const ChecklistRoot = styled.ul`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => `${theme.space.xxs} ${theme.space.md}`};
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export const ChecklistItem = styled.li<{ $passed: boolean }>`
  display: flex;
  gap: ${({ theme }) => theme.space.xs};
  color: ${({ theme, $passed }) =>
    $passed ? theme.colors.tones.success.foreground : theme.colors.textMuted};
`;
