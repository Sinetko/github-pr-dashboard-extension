import styled from 'styled-components';

export const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.sm};
  padding-bottom: ${({ theme }) => theme.space.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:last-child {
    border-bottom: 0;
  }
`;

export const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.md};
`;

export const SectionText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
`;
