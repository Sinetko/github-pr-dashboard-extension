import styled from 'styled-components';

export const CollapsibleHeader = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.xs};
  width: 100%;
  padding: ${({ theme }) => `${theme.space.xs} 0`};
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.bold};
  text-align: left;
  cursor: pointer;
`;

export const Chevron = styled.span<{ $isOpen: boolean }>`
  display: inline-block;
  transform: rotate(${({ $isOpen }) => ($isOpen ? '90deg' : '0deg')});
  transition: transform ${({ theme }) => theme.motion.fast};
`;
