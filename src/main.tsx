
import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { AuthContextProvider } from '@/contexts/AuthContext';
import { SessionProvider } from '@/contexts/SessionProvider';
import { NetworkProvider } from '@/contexts/NetworkStatusContext';
import { GameManagerProvider } from '@/contexts/GameManager';

import App from './App';
import './index.css';

import { logWithTimestamp } from './utils/logUtils';
import { patchReactForIdPolyfill, logReactEnvironment } from './utils/reactUtils';

// Log React environment information
logReactEnvironment();

// Log initialization
logWithTimestamp('[Initialization] ReactDOM type: ' + typeof ReactDOM, 'info');
logWithTimestamp('[Initialization] Initializing application with React 17 rendering method', 'info');

// Patch React to ensure useId doesn't throw errors
patchReactForIdPolyfill();

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

ReactDOM.render(
  <BrowserRouter>
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <NetworkProvider>
          <AuthContextProvider>
            <GameManagerProvider>
              <SessionProvider>
                <Toaster position="bottom-right" />
                <App />
              </SessionProvider>
            </GameManagerProvider>
          </AuthContextProvider>
        </NetworkProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </BrowserRouter>,
  document.getElementById('root'),
  () => {
    logWithTimestamp('[Initialization] Application successfully mounted to DOM', 'info');
  }
);
