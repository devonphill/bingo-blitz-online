
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById("root");

if (rootElement) {
  // Use render method for React 17
  ReactDOM.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    rootElement
  );
}
