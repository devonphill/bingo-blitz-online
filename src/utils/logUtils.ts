
// Utility functions for logging
import React from 'react';

// Log levels
const LOG_LEVEL = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Current log level (can be changed at runtime)
let currentLogLevel = LOG_LEVEL.INFO;

// Set the current log level
export function setLogLevel(level) {
  currentLogLevel = level;
}

// Debug log
export function logDebug(...args) {
  if (currentLogLevel <= LOG_LEVEL.DEBUG) {
    console.debug(...args);
  }
}

// Info log
export function logInfo(...args) {
  if (currentLogLevel <= LOG_LEVEL.INFO) {
    console.info(...args);
  }
}

// Warning log
export function logWarn(...args) {
  if (currentLogLevel <= LOG_LEVEL.WARN) {
    console.warn(...args);
  }
}

// Error log
export function logError(...args) {
  if (currentLogLevel <= LOG_LEVEL.ERROR) {
    console.error(...args);
  }
}

// Fix React 18 detection code - remove createRoot check which doesn't exist in React 17
export function logReactEnvironment() {
  try {
    const reactVersion = React?.version;
    logInfo(`[ReactEnv] React version: ${reactVersion}`);
    
    if (!window.React) {
      logError('[ReactEnv] React not found in window object');
    }
    
    // Remove the check for ReactDOM.createRoot which is not available in React 17
  } catch (error) {
    logError('[ReactEnv] Error detecting React environment:', error);
  }
}

// Performance logging
export function logPerformance(label, callback) {
  if (currentLogLevel <= LOG_LEVEL.DEBUG) {
    console.time(label);
    const result = callback();
    console.timeEnd(label);
    return result;
  } else {
    return callback();
  }
}

// Group logs
export function logGroup(label, callback) {
  if (currentLogLevel <= LOG_LEVEL.DEBUG) {
    console.group(label);
    const result = callback();
    console.groupEnd();
    return result;
  } else {
    return callback();
  }
}

// Format object for logging
export function formatObject(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    return `[Unserializable object: ${error.message}]`;
  }
}

/**
 * Log with timestamp and optional level
 * This is the function that was missing but is imported by many components
 */
export function logWithTimestamp(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  
  switch(level.toLowerCase()) {
    case 'debug':
      logDebug(formattedMessage);
      break;
    case 'warn':
    case 'warning':
      logWarn(formattedMessage);
      break;
    case 'error':
      logError(formattedMessage);
      break;
    case 'info':
    default:
      logInfo(formattedMessage);
      break;
  }
  
  return formattedMessage;
}

