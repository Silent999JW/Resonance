import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register PWA service worker for offline app mode
if ('serviceWorker' in navigator && !(window as any).electron) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('ServiceWorker registered with scope: ', reg.scope);
        // Force update to fetch the latest sw.js containing the blob-handling fix immediately
        reg.update().catch(console.warn);
      })
      .catch((err) => console.warn('ServiceWorker registration failed: ', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
