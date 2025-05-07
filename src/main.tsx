
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App.tsx';
import './index.css';
import { logWithTimestamp, logReactEnvironment } from '@/utils/logUtils';

// Debug logging for React initialization
logWithTimestamp("React version: " + React.version, "info", "Initialization");
logWithTimestamp("ReactDOM type: " + typeof ReactDOM, "info", "Initialization");
logWithTimestamp("Initializing application with React 17 rendering method", "info", "Initialization");

// Log React environment to check for React 18 hooks
logReactEnvironment();

// Add global error handler
window.addEventListener('error', (event) => {
  logWithTimestamp(`Global error: ${event.message}`, "error", "Window");
  logWithTimestamp(`Source: ${event.filename}:${event.lineno}:${event.colno}`, "error", "Window");
});

// Check for React global availability
if (typeof React === 'undefined') {
  logWithTimestamp("React is not defined globally - this will cause compatibility issues", "error", "Initialization");
}

const rootElement = document.getElementById("root");

if (rootElement) {
  try {
    // Use React 17's render method - do not use createRoot which is for React 18
    ReactDOM.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
      rootElement
    );
    logWithTimestamp("Application successfully mounted to DOM", "info", "Initialization");
  } catch (error) {
    logWithTimestamp(`Failed to render application: ${JSON.stringify(error)}`, "error", "Initialization");
    console.error("Failed to render application:", error);
  }
} else {
  logWithTimestamp("Root element not found", "error", "Initialization");
}
