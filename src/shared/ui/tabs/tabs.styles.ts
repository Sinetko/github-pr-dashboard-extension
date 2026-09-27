import styled from 'styled-components';

export const TabList = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.xxs};
  overflow-x: auto;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  scrollbar-width: none;
`;

export const TabButton = styled.button<{ $isSelected: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.xs};
  padding: ${({ theme }) => `${theme.space.sm} ${theme.space.sm}`};
  border: 0;
  border-bottom: 2px solid
    ${({ theme, $isSelected }) => ($isSelected ? theme.colors.tones.warning.border : 'transparent')};
  background: transparent;
  color: ${({ theme, $isSelected }) => ($isSelected ? theme.colors.text : theme.colors.textMuted)};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme, $isSelected }) =>
    $isSelected ? theme.font.weight.bold : theme.font.weight.regular};
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

export const TabCount = styled.span`
  padding: 0 ${({ theme }) => theme.space.xs};
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.surfaceHover};
  font-size: ${({ theme }) => theme.font.size.xs};
`;
