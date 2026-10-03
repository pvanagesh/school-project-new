import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthContext';
import { SchoolProfileProvider } from './school/SchoolProfileContext';
import { ActiveDivisionProvider } from './school/ActiveDivisionContext';
import { theme } from './theme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <SchoolProfileProvider>
            <ActiveDivisionProvider>
              <App />
            </ActiveDivisionProvider>
          </SchoolProfileProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
