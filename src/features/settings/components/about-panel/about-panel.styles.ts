import styled from 'styled-components';

export const Paragraph = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.md};
`;

export const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.size.xs};
`;
