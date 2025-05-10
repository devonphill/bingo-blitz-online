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
 * Check if an element is visible in the DOM with enhanced checks
 * @param element The DOM element to check
 * @returns Boolean indicating if the element is visible
 */
export function isElementVisible(element: HTMLElement | null): boolean {
  if (!element) {
    logWithTimestamp('Element visibility check: Element is null', 'warn', 'DOMCheck');
    return false;
  }
  
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const isDisplayed = style.display !== 'none';
  const isVisible = style.visibility !== 'hidden';
  const isNotTransparent = parseFloat(style.opacity) > 0;
  const hasNonZeroArea = rect.width > 0 && rect.height > 0;
  const isInDOM = document.body.contains(element);
  const zIndex = parseInt(style.zIndex, 10);
  
  logWithTimestamp(
    `Element visibility check: display=${style.display}, visibility=${style.visibility}, ` +
    `opacity=${style.opacity}, width=${rect.width}, height=${rect.height}, ` +
    `z-index=${isNaN(zIndex) ? 'auto' : zIndex}, inDOM=${isInDOM}`,
    'debug',
    'DOMCheck'
  );
  
  return isDisplayed && isVisible && isNotTransparent && hasNonZeroArea && isInDOM;
}

/**
 * Log DOM element visibility with enhanced details - useful for debugging UI issues
 * @param selector CSS selector to find the element
 * @param name Optional name for the element (for logging)
 */
export function logElementVisibility(selector: string, name: string = selector): void {
  setTimeout(() => {
    try {
      const element = document.querySelector(selector) as HTMLElement;
      const isVisible = isElementVisible(element);
      
      if (!element) {
        logWithTimestamp(`Element "${name}" (${selector}): NOT FOUND IN DOM`, 'warn', 'DOMVisibility');
        return;
      }
      
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const zIndex = style.zIndex;
      const position = style.position;
      
      logWithTimestamp(
        `Element "${name}" (${selector}): visible=${isVisible}, z-index=${zIndex}, ` +
        `position=${position}, width=${rect.width}px, height=${rect.height}px, ` +
        `opacity=${style.opacity}, display=${style.display}, visibility=${style.visibility}`,
        'info',
        'DOMVisibility'
      );
      
      // Check if element might be hidden by another element with higher z-index
      if (isVisible) {
        const elementAtPoint = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2
        );
        
        if (elementAtPoint && !element.contains(elementAtPoint) && !elementAtPoint.contains(element)) {
          logWithTimestamp(
            `Element "${name}" may be covered by another element: ${elementAtPoint.tagName} ` +
            `with class "${elementAtPoint.className}"`,
            'warn',
            'DOMVisibility'
          );
        }
      }
      
      // In debug mode, highlight the element temporarily
      if (currentLogLevel <= LOG_LEVEL.DEBUG) {
        const originalOutline = element.style.outline;
        const originalZIndex = element.style.zIndex;
        element.style.outline = '3px solid red';
        element.style.zIndex = '10000';
        
        setTimeout(() => {
          element.style.outline = originalOutline;
          element.style.zIndex = originalZIndex;
        }, 3000);
      }
    } catch (err) {
      logWithTimestamp(`Error checking visibility for "${name}": ${(err as Error).message}`, 'error', 'DOMVisibility');
    }
  }, 100);
}
