import styled from 'styled-components';

export const EmptyStateRoot = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space.sm};
  padding: ${({ theme }) => `${theme.space.xl} ${theme.space.lg}`};
  text-align: center;
`;

export const EmptyStateTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.bold};
`;

export const EmptyStateDescription = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
`;
