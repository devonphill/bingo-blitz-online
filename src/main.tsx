
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App.tsx';
import './index.css';

// Debug logging for React initialization
console.log("React version:", React.version);
console.log("ReactDOM:", typeof ReactDOM);
console.log("Initializing application with React 17 rendering method");

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
    console.log("Application successfully mounted to DOM");
  } catch (error) {
    console.error("Failed to render application:", error);
  }
}
