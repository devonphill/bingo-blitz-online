
/**
 * Helper function for consistent timestamped logging
 */
export const logWithTimestamp = (message: string) => {
  const now = new Date();
  const timestamp = now.toISOString();
  console.log(`[${timestamp}] - ${message}`);
};

/**
 * Helper function to log connection state changes
 */
export const logConnectionState = (component: string, state: string, isConnected: boolean) => {
  logWithTimestamp(`${component}: connection state: ${state}, isConnected: ${isConnected}`);
};

/**
 * Helper function to check if channel is in a connected state
 */
export const isChannelConnected = (status: string): boolean => {
  return status === 'SUBSCRIBED';
};

/**
 * Helper function to log detailed connection attempts with ID
 */
export const logConnectionAttempt = (component: string, sessionId: string, attempt: number, maxAttempts: number) => {
  logWithTimestamp(`${component}: Attempt ${attempt}/${maxAttempts} to connect to session ${sessionId}`);
};

/**
 * Helper function to log successful connection
 */
export const logConnectionSuccess = (component: string, sessionId: string) => {
  logWithTimestamp(`${component}: Successfully connected to game server for session ${sessionId}`);
};

/**
 * Helper function to serialize an object for logging
 * Prevents circular references
 */
export const safeLogObject = (obj: any): string => {
  try {
    // Using a replacer function to handle circular references
    const cache: any[] = [];
    const result = JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.includes(value)) return '[Circular]';
        cache.push(value);
      }
      return value;
    }, 2);
    return result;
  } catch (e) {
    return `[Error serializing object: ${e}]`;
  }
};
