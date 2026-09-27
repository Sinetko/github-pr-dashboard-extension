import styled from 'styled-components';

export const SwitchRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.md};
`;

export const SwitchText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.xxs};
`;

export const SwitchLabel = styled.label`
  font-size: ${({ theme }) => theme.font.size.md};
  cursor: pointer;
`;

export const SwitchDescription = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export const Track = styled.button<{ $checked: boolean }>`
  position: relative;
  flex-shrink: 0;
  width: 34px;
  height: 20px;
  padding: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme, $checked }) =>
    $checked ? theme.colors.tones.accent.foreground : theme.colors.surfaceHover};
  cursor: pointer;
  transition: background-color ${({ theme }) => theme.motion.fast};

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: ${({ $checked }) => ($checked ? '16px' : '2px')};
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ffffff;
    transition: left ${({ theme }) => theme.motion.fast};
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`;
