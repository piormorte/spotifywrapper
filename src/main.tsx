import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter/wght.css';
import { App } from './app/App.tsx';
import { LibraryProvider } from './app/LibraryProvider.tsx';
import { UpdateNotice } from './app/UpdateNotice.tsx';
import { startInstallCapture } from './pwa/install.ts';
import './app/global.css';

startInstallCapture();

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <LibraryProvider>
      <App />
      <UpdateNotice />
    </LibraryProvider>
  </StrictMode>,
);
