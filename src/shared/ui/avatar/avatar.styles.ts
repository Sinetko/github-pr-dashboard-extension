import styled from 'styled-components';

export const AvatarImage = styled.img<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
  background: ${({ theme }) => theme.colors.surface};
`;

export const AvatarFallback = styled.span<{ $size: number }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.surfaceHover};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ $size }) => Math.max(9, Math.round($size * 0.4))}px;
  font-weight: ${({ theme }) => theme.font.weight.bold};
`;
