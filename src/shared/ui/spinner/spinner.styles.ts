import styled, { keyframes } from 'styled-components';

const rotate = keyframes`to { transform: rotate(360deg); }`;

export const SpinnerRing = styled.span<{ $size: number }>`
  display: inline-block;
  flex-shrink: 0;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  opacity: 0.8;
  animation: ${rotate} 0.7s linear infinite;
`;
