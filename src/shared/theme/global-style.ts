import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.font.family};
    font-size: ${({ theme }) => theme.font.size.md};
    line-height: 1.4;
    color-scheme: ${({ theme }) => theme.scheme};
    -webkit-font-smoothing: antialiased;
  }
  button, input, select, textarea { font: inherit; color: inherit; }
  :focus-visible { outline: 2px solid ${({ theme }) => theme.colors.focusRing}; outline-offset: 1px; }
  .visually-hidden {
    position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition: none !important; animation: none !important; }
  }
`;
