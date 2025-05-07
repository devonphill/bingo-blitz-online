
/**
 * Improved logging utility with timestamp and debug level support
 */

// Configure debug levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const LOG_LEVEL: LogLevel = 'debug'; // Set to 'debug' to see all logs

/**
 * Log a message with a timestamp and component name
 */
export function logWithTimestamp(message: string, level: LogLevel = 'info', component?: string): void {
  // Skip debug logs if not in debug mode
  if (level === 'debug' && LOG_LEVEL !== 'debug') return;
  
  const now = new Date();
  const timestamp = now.toISOString();
  const componentPrefix = component ? `[${component}] ` : '';
  
  const logMessage = `[${timestamp}] ${componentPrefix}${message}`;
  
  switch (level) {
    case 'debug':
      console.debug(logMessage);
      break;
    case 'info':
      console.log(logMessage);
      break;
    case 'warn':
      console.warn(logMessage);
      break;
    case 'error':
      console.error(logMessage);
      break;
    default:
      console.log(logMessage);
  }
}

/**
 * Create a logger for a specific component
 */
export function createLogger(componentName: string) {
  return {
    debug: (message: string) => logWithTimestamp(message, 'debug', componentName),
    info: (message: string) => logWithTimestamp(message, 'info', componentName),
    warn: (message: string) => logWithTimestamp(message, 'warn', componentName),
    error: (message: string) => logWithTimestamp(message, 'error', componentName)
  };
}

/**
 * Log connection events for debugging
 */
export function logConnectionEvent(event: string, details?: any): void {
  logWithTimestamp(`Connection Event: ${event}${details ? ` - ${JSON.stringify(details)}` : ''}`, 'info', 'Connection');
}

/**
 * Debug any object with pretty printing
 */
export function debugObject(label: string, obj: any, level: LogLevel = 'debug'): void {
  try {
    logWithTimestamp(`${label}: ${JSON.stringify(obj, null, 2)}`, level, 'Debug');
  } catch (e) {
    logWithTimestamp(`${label}: [Cannot stringify object: ${e}]`, level, 'Debug');
  }
}

/**
 * Convert string to LogLevel safely
 */
export function ensureLogLevel(level: string | LogLevel): LogLevel {
  const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  return validLevels.includes(level as LogLevel) ? level as LogLevel : 'info';
}

/**
 * Log with parameters - safely handle objects that should not be used as the message
 */
export function logWithParams(message: string, params: any, level: LogLevel = 'info', component?: string): void {
  // Ensure we're using a string message and not an object
  if (typeof message !== 'string') {
    try {
      message = JSON.stringify(message);
    } catch (e) {
      message = '[Object cannot be stringified]';
    }
  }
  
  // Log with the parameters
  logWithTimestamp(`${message} ${params ? JSON.stringify(params) : ''}`, level, component);
}

/**
 * Enhanced error logging with stack trace and context
 */
export function logError(error: Error, context: string, additionalInfo?: any): void {
  logWithTimestamp(
    `ERROR in ${context}: ${error.message}\n` +
    `Stack: ${error.stack || 'No stack trace'}\n` +
    `Additional info: ${additionalInfo ? JSON.stringify(additionalInfo) : 'None'}`,
    'error',
    'ErrorHandler'
  );
}

/**
 * Track React component lifecycle for debugging
 * @param componentName The name of the component
 * @param phase The lifecycle phase (mount, render, update, unmount)
 * @param props Optional component props to log
 */
export function logLifecycle(componentName: string, phase: 'mount' | 'render' | 'update' | 'unmount', props?: any): void {
  const propsStr = props ? ` with props: ${JSON.stringify(props, null, 2)}` : '';
  logWithTimestamp(`Component ${componentName} - ${phase}${propsStr}`, 'debug', 'Lifecycle');
}

/**
 * Log React version and available APIs for debugging
 */
export function logReactEnvironment(): void {
  try {
    const React = window.React;
    if (!React) {
      logWithTimestamp("React not found in window object", "error", "ReactEnv");
      return;
    }
    
    logWithTimestamp(`React version: ${React.version}`, "info", "ReactEnv");
    
    // Check for React 18 features
    const hasUseId = typeof React.useId === 'function';
    const hasUseTransition = typeof React.useTransition === 'function';
    const hasUseDeferredValue = typeof React.useDeferredValue === 'function';
    
    logWithTimestamp(
      `React 18 features: useId=${hasUseId}, useTransition=${hasUseTransition}, useDeferredValue=${hasUseDeferredValue}`,
      "info",
      "ReactEnv"
    );
    
    // Log component rendering method
    const ReactDOM = window.ReactDOM;
    if (ReactDOM) {
      // Removed the createRoot check as it's not available in React 17
      logWithTimestamp(
        `ReactDOM rendering: render=${typeof ReactDOM.render === 'function'}`,
        "info", 
        "ReactEnv"
      );
    }
  } catch (e) {
    logWithTimestamp(`Error logging React environment: ${e}`, "error", "ReactEnv");
  }
}
