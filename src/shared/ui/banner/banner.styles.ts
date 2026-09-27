import styled from 'styled-components';

import type { Tone } from '../../theme';

export const BannerRoot = styled.div<{ $tone: Tone }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.space.sm};
  padding: ${({ theme }) => `${theme.space.sm} ${theme.space.md}`};
  border: 1px solid ${({ theme, $tone }) => theme.colors.tones[$tone].border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme, $tone }) => theme.colors.tones[$tone].subtle};
`;

export const BannerBody = styled.div`
  flex: 1;
  min-width: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export const BannerTitle = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.bold};
`;
