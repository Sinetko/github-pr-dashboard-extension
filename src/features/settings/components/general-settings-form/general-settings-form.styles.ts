import styled from 'styled-components';

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.lg};
`;

export const Section = styled.fieldset`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.sm};
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
`;

export const Legend = styled.legend`
  margin-bottom: ${({ theme }) => theme.space.sm};
  padding: 0;
  font-weight: ${({ theme }) => theme.font.weight.bold};
`;

export const HintText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export const ErrorText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.tones.danger.foreground};
  font-size: ${({ theme }) => theme.font.size.sm};
`;
