import styled from 'styled-components';

export const SelectField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.xs};
`;

export const SelectLabel = styled.label<{ $isHidden: boolean }>`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.bold};
  ${({ $isHidden }) =>
    $isHidden
      ? 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;'
      : ''}
`;

export const NativeSelect = styled.select`
  min-height: 28px;
  padding: ${({ theme }) => `${theme.space.xxs} ${theme.space.sm}`};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
`;
