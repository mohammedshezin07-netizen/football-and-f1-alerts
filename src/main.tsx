import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Proactively check for OTA updates when app launches
        registration.update().catch(() => {});
      })
      .catch(() => {
        // Ignore service worker registration errors in restricted preview frames
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);

