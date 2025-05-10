
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
    console.debug('[DEBUG]', ...args);
  }
}

// Info log
export function logInfo(...args) {
  if (currentLogLevel <= LOG_LEVEL.INFO) {
    console.info('[INFO]', ...args);
  }
}

// Warning log
export function logWarn(...args) {
  if (currentLogLevel <= LOG_LEVEL.WARN) {
    console.warn('[WARN]', ...args);
  }
}

// Error log
export function logError(...args) {
  if (currentLogLevel <= LOG_LEVEL.ERROR) {
    console.error('[ERROR]', ...args);
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
 * Log with timestamp and optional level and category
 * @param message The message to log
 * @param level The log level ('debug', 'info', 'warn', 'error')
 * @param category Optional category or context for the log
 * @returns The formatted message that was logged
 */
export function logWithTimestamp(message: string, level: string = 'info', category?: string): string {
  const timestamp = new Date().toISOString();
  let formattedMessage = `[${timestamp}] ${message}`;
  
  // Add category if provided
  if (category) {
    formattedMessage = `[${timestamp}] [${category}] ${message}`;
  }
  
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

/**
 * Log UI component rendering - useful for detecting render issues
 * @param componentName The name of the component being rendered
 * @param props Optional props to log
 */
export function logComponentRender(componentName: string, props?: any): void {
  if (currentLogLevel <= LOG_LEVEL.DEBUG) {
    const propsStr = props ? ` with props: ${formatObject(props)}` : '';
    logDebug(`Rendering ${componentName}${propsStr}`);
  }
}

/**
 * Check if an element is visible in the DOM
 * @param element The DOM element to check
 * @returns Boolean indicating if the element is visible
 */
export function isElementVisible(element: HTMLElement | null): boolean {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  const isDisplayed = style.display !== 'none';
  const isVisible = style.visibility !== 'hidden';
  const hasNonZeroArea = element.offsetWidth > 0 && element.offsetHeight > 0;
  const isInDOM = document.body.contains(element);
  
  logWithTimestamp(
    `Element visibility check: display=${style.display}, visibility=${style.visibility}, ` +
    `width=${element.offsetWidth}, height=${element.offsetHeight}, inDOM=${isInDOM}`,
    'debug',
    'DOMCheck'
  );
  
  return isDisplayed && isVisible && hasNonZeroArea && isInDOM;
}

/**
 * Log DOM element visibility - useful for debugging UI issues
 * @param selector CSS selector to find the element
 * @param name Optional name for the element (for logging)
 */
export function logElementVisibility(selector: string, name: string = selector): void {
  setTimeout(() => {
    try {
      const element = document.querySelector(selector) as HTMLElement;
      const isVisible = isElementVisible(element);
      const zIndex = element ? window.getComputedStyle(element).zIndex : 'N/A';
      const position = element ? window.getComputedStyle(element).position : 'N/A';
      
      logWithTimestamp(
        `Element "${name}" (${selector}): visible=${isVisible}, z-index=${zIndex}, position=${position}`,
        'info',
        'DOMVisibility'
      );
    } catch (err) {
      logWithTimestamp(`Error checking visibility for "${name}": ${(err as Error).message}`, 'error', 'DOMVisibility');
    }
  }, 100);
}

