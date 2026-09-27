import styled from 'styled-components';

export const PointList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.md};
  margin: 0;
  padding: 0;
  list-style: none;
`;

export const PointTitle = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.bold};
`;

export const PointBody = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
`;
