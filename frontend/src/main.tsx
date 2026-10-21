import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter } from './App';
import { DemoProvider } from './context/Demo';
import { ToastProvider } from './context/Toast';
import './styles.css';

const router = createAppRouter();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </DemoProvider>
  </StrictMode>,
);
