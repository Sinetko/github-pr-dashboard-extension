import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App, createPopupServices } from './app';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Popup root element is missing');
}

createRoot(rootElement).render(
  <StrictMode>
    <App services={createPopupServices()} />
  </StrictMode>,
);
