import styled from 'styled-components';

export const DashboardRoot = styled.section`
  display: flex;
  flex-direction: column;
`;

export const Header = styled.header`
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.sm};
  padding: ${({ theme }) => `${theme.space.sm} ${theme.space.lg}`};
  background: ${({ theme }) => theme.colors.background};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

export const HeaderTitle = styled.h1`
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: ${({ theme }) => theme.font.size.md};
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const SourceSlot = styled.div`
  flex: 1;
  min-width: 0;

  select {
    width: 100%;
  }
`;

export const TabsSlot = styled.div`
  padding: 0 ${({ theme }) => theme.space.lg};
`;

export const Centered = styled.div`
  display: flex;
  justify-content: center;
  padding: ${({ theme }) => theme.space.xl};
`;
