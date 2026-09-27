import styled from 'styled-components';

export const ScreenRoot = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.lg};
  padding: ${({ theme }) => theme.space.lg};
`;

export const ScreenHeader = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.sm};
`;

export const ScreenHeading = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.xs};
`;

export const ScreenTitle = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.bold};
`;

export const ScreenDescription = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export const ScreenFooter = styled.footer`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.space.sm};
`;
