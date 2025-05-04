
/**
 * Improved logging utility with timestamp and debug level support
 */

// Configure debug levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const LOG_LEVEL: LogLevel = 'info'; // Set to 'debug' to see all logs

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
