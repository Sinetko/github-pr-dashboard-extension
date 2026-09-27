import styled from 'styled-components';

export const StatsRoot = styled.div`
  padding: 0 ${({ theme }) => theme.space.lg};
`;

export const TileGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.space.xs};
  margin: ${({ theme }) => `${theme.space.xs} 0 ${theme.space.sm}`};
`;

export const Tile = styled.div`
  display: flex;
  flex-direction: column-reverse;
  padding: ${({ theme }) => `${theme.space.xs} ${theme.space.sm}`};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface};
`;

export const TileLabel = styled.dt`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

export const TileValue = styled.dd`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.bold};
  font-variant-numeric: tabular-nums;
`;
