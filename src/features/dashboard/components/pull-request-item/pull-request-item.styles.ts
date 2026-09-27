import styled from 'styled-components';

export const ItemRoot = styled.li`
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

export const ItemLink = styled.a`
  display: flex;
  gap: ${({ theme }) => theme.space.sm};
  padding: ${({ theme }) => `${theme.space.sm} ${theme.space.lg}`};
  color: inherit;
  text-decoration: none;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
  }
  &:focus-visible {
    outline-offset: -2px;
  }
`;

export const ItemBody = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.xxs};
  min-width: 0;
`;

export const Title = styled.span`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  overflow-wrap: anywhere;
`;

export const Meta = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

export const PillRow = styled.span`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space.xs};
  margin-top: ${({ theme }) => theme.space.xxs};
`;

export const LabelChip = styled.span<{ $color: string }>`
  padding: 0 ${({ theme }) => theme.space.xs};
  border: 1px solid #${({ $color }) => $color};
  border-radius: ${({ theme }) => theme.radii.pill};
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.font.size.xs};
  line-height: 18px;
`;
