
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

/**
 * Helper to determine if a new connection attempt should be made
 * Prevents connection loops by checking for recent reconnect attempts
 */
export const shouldAttemptReconnect = (lastAttemptTime: number | null, connectionState: string): boolean => {
  // If we've never attempted to connect or the state is explicitly disconnected, allow connection
  if (lastAttemptTime === null || connectionState === 'disconnected') {
    return true;
  }
  
  // Don't reconnect if we're already connecting or connected
  if (connectionState === 'connecting' || connectionState === 'connected') {
    return false;
  }
  
  // Only allow reconnection if more than 5 seconds have passed since last attempt
  const now = Date.now();
  const timeSinceLastAttempt = now - lastAttemptTime;
  return timeSinceLastAttempt > 5000; // 5 seconds delay between reconnect attempts
};

/**
 * Helper function to log connection cleanup actions
 */
export const logConnectionCleanup = (component: string, reason: string) => {
  logWithTimestamp(`${component}: Cleaning up connection (${reason})`);
};

/**
 * Helper function for tracking connection events and preventing loops
 */
export const preventConnectionLoop = (connectionStateRef: { current: any }): boolean => {
  if (!connectionStateRef.current) {
    connectionStateRef.current = {
      attempts: 0,
      lastAttempt: Date.now(),
      inProgress: true
    };
    return false; // Not in a loop, proceed with connection
  }
  
  const now = Date.now();
  const timeSince = now - connectionStateRef.current.lastAttempt;
  
  // If multiple attempts in less than 3 seconds, might be in a loop
  if (connectionStateRef.current.attempts > 2 && timeSince < 3000) {
    connectionStateRef.current.attempts++;
    connectionStateRef.current.inLoop = true;
    logWithTimestamp(`Detected potential connection loop after ${connectionStateRef.current.attempts} attempts in ${timeSince}ms`);
    return true; // Likely in a loop, prevent further connection attempts
  }
  
  // Update connection state
  connectionStateRef.current.attempts++;
  connectionStateRef.current.lastAttempt = now;
  connectionStateRef.current.inProgress = true;
  connectionStateRef.current.inLoop = false;
  
  return false; // Not in a loop, proceed with connection
};

/**
 * Create a structured delay function that properly suppresses connection attempts
 * when multiple useEffect hooks may be triggering them
 */
export const createDelayedConnectionAttempt = (
  callback: () => void, 
  delayMs: number = 5000,
  isMountedRef: React.MutableRefObject<boolean>,
  connectionRef: React.MutableRefObject<{
    pendingTimeout: ReturnType<typeof setTimeout> | null,
    isSuspended: boolean
  }>
) => {
  // Clear any existing timeouts
  if (connectionRef.current.pendingTimeout) {
    clearTimeout(connectionRef.current.pendingTimeout);
    connectionRef.current.pendingTimeout = null;
  }
  
  // If connection is suspended, don't schedule anything
  if (connectionRef.current.isSuspended) {
    logWithTimestamp(`Connection attempts are suspended. Ignoring request.`);
    return;
  }
  
  // Set a new timeout
  logWithTimestamp(`Scheduling connection attempt in ${delayMs}ms`);
  connectionRef.current.pendingTimeout = setTimeout(() => {
    if (isMountedRef.current && !connectionRef.current.isSuspended) {
      callback();
    }
    connectionRef.current.pendingTimeout = null;
  }, delayMs);
};

/**
 * Suspend connection attempts for a period of time
 */
export const suspendConnectionAttempts = (
  connectionRef: React.MutableRefObject<{
    pendingTimeout: ReturnType<typeof setTimeout> | null,
    isSuspended: boolean
  }>,
  durationMs: number = 10000
) => {
  // Clear any pending timeouts
  if (connectionRef.current.pendingTimeout) {
    clearTimeout(connectionRef.current.pendingTimeout);
    connectionRef.current.pendingTimeout = null;
  }
  
  // Set the suspended flag
  connectionRef.current.isSuspended = true;
  logWithTimestamp(`Connection attempts suspended for ${durationMs}ms`);
  
  // Set timeout to clear the suspension
  setTimeout(() => {
    connectionRef.current.isSuspended = false;
    logWithTimestamp(`Connection suspension lifted`);
  }, durationMs);
};
