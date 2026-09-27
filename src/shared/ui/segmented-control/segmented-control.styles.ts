import styled from 'styled-components';

export const SegmentGroup = styled.div`
  display: inline-flex;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  overflow: hidden;
`;

export const Segment = styled.button<{ $isSelected: boolean }>`
  padding: ${({ theme }) => `${theme.space.xxs} ${theme.space.sm}`};
  border: 0;
  border-left: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme, $isSelected }) =>
    $isSelected ? theme.colors.surfaceHover : theme.colors.background};
  color: ${({ theme, $isSelected }) => ($isSelected ? theme.colors.text : theme.colors.textMuted)};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme, $isSelected }) =>
    $isSelected ? theme.font.weight.bold : theme.font.weight.regular};
  cursor: pointer;

  &:first-child {
    border-left: 0;
  }
`;
