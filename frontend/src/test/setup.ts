import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Component tests drive multi-step forms; allow slower CI/sandbox machines.
configure({ asyncUtilTimeout: 4000 });
