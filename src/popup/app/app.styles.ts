import styled from 'styled-components';

export const POPUP_WIDTH = 600;
export const POPUP_HEIGHT = 600;

export const AppRoot = styled.main`
  width: ${POPUP_WIDTH}px;
  height: ${POPUP_HEIGHT}px;
  overflow-y: auto;
`;

export const CenteredState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`;
