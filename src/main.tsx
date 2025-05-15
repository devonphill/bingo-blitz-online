
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
import { logReactEnvironment, patchReactHooks } from './utils/reactUtils';
import { patchReactForCompatibility } from './utils/reactCompatUtils';
import { SingleSourceTrueConnections } from './utils/SingleSourceTrueConnections';

// Apply all React compatibility patches as early as possible - before any component imports
// This needs to run before any React components are rendered
logWithTimestamp('[Initialization] Starting React compatibility patching', 'info');

// Apply patches from both utilities to maximize compatibility
patchReactForCompatibility();
patchReactHooks();

// Log React environment information
logReactEnvironment();

// Initialize SingleSourceTrueConnections EARLY to ensure WebSocketService is ready
// This must happen before any component that uses WebSockets is rendered
logWithTimestamp('[Initialization] Initializing SingleSourceTrueConnections', 'info');
SingleSourceTrueConnections.getInstance();

// Log initialization
logWithTimestamp('[Initialization] ReactDOM type: ' + typeof ReactDOM, 'info');
logWithTimestamp('[Initialization] Initializing application with React 17 rendering method', 'info');

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

// Create a root component to ensure proper context nesting
const Root = () => {
  return (
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
  );
};

// Make sure React is patched before rendering
if (typeof window !== 'undefined') {
  // Additional safety check to ensure React is patched before mounting
  window.addEventListener('DOMContentLoaded', () => {
    // Apply compatibility patch again right before mounting
    patchReactForCompatibility();
    patchReactHooks();
    
    // Render the app
    ReactDOM.render(
      <BrowserRouter>
        <Root />
      </BrowserRouter>,
      document.getElementById('root'),
      () => {
        logWithTimestamp('[Initialization] Application successfully mounted to DOM', 'info');
      }
    );
  });
} else {
  // Fallback for environments without window
  ReactDOM.render(
    <BrowserRouter>
      <Root />
    </BrowserRouter>,
    document.getElementById('root'),
    () => {
      logWithTimestamp('[Initialization] Application successfully mounted to DOM', 'info');
    }
  );
}
