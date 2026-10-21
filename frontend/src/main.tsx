import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { DemoProvider } from './context/Demo';
import { ToastProvider } from './context/Toast';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <DemoProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </DemoProvider>
    </BrowserRouter>
  </StrictMode>,
);
