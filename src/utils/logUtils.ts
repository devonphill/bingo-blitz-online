// Utility functions for logging and connection management

/**
 * Log a message with a timestamp
 */
export function logWithTimestamp(message: string) {
  const now = new Date();
  const timestamp = now.toISOString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Global tracker for connection instances
 * This helps prevent connection loops by tracking active connections per session
 */
const globalConnectionTracker: {
  [sessionId: string]: {
    instances: Set<string>,
    lastReconnect: number
  }
} = {};

/**
 * Completely cleans up all tracked connections
 * Use this to break connection loops
 */
export function cleanupAllConnections() {
  logWithTimestamp('Global connection cleanup: Resetting all connection states');
  
  // Reset the entire connection tracker
  for (const sessionId in globalConnectionTracker) {
    delete globalConnectionTracker[sessionId];
  }
  
  logWithTimestamp('All connection states have been reset');
}

/**
 * Registers a successful connection with the global tracker
 */
export function registerSuccessfulConnection(sessionId: string, instanceId: string) {
  if (!sessionId || !instanceId) return;
  
  if (!globalConnectionTracker[sessionId]) {
    globalConnectionTracker[sessionId] = {
      instances: new Set(),
      lastReconnect: Date.now()
    };
  }
  
  globalConnectionTracker[sessionId].instances.add(instanceId);
  logWithTimestamp(`Registered connection for session ${sessionId}, instance ${instanceId}`);
}

/**
 * Unregisters a connection instance from the global tracker
 */
export function unregisterConnectionInstance(sessionId: string, instanceId: string) {
  if (!sessionId || !instanceId || !globalConnectionTracker[sessionId]) return;
  
  globalConnectionTracker[sessionId].instances.delete(instanceId);
  logWithTimestamp(`Unregistered connection for session ${sessionId}, instance ${instanceId}`);
  
  if (globalConnectionTracker[sessionId].instances.size === 0) {
    delete globalConnectionTracker[sessionId];
    logWithTimestamp(`Removed tracking for session ${sessionId} - no more active instances`);
  }
}

/**
 * Checks if we might be in a connection loop and if so, prevents further connection attempts
 */
export function preventConnectionLoop(
  sessionId: string, 
  instanceId: string,
  loopStateRef: React.MutableRefObject<any>
): boolean {
  if (!sessionId || !instanceId) return false;
  
  // Initialize tracker for this session if needed
  if (!globalConnectionTracker[sessionId]) {
    globalConnectionTracker[sessionId] = {
      instances: new Set(),
      lastReconnect: Date.now()
    };
  }
  
  const tracker = globalConnectionTracker[sessionId];
  
  // Check if we already have this instance registered
  const alreadyRegistered = tracker.instances.has(instanceId);
  
  // If we have multiple instances or this instance is already trying to connect, we might be in a loop
  const potentialLoop = tracker.instances.size > 0 || alreadyRegistered;
  
  if (potentialLoop) {
    // Check if we're reconnecting too quickly
    const timeSinceLastReconnect = Date.now() - tracker.lastReconnect;
    const isTooQuick = timeSinceLastReconnect < 30000; // 30 seconds cooldown
    
    if (isTooQuick) {
      logWithTimestamp(`⚠️ Detected connection loop for session ${sessionId} with ${tracker.instances.size} active instances - enforcing 30s cooldown`);
      
      if (loopStateRef.current) {
        loopStateRef.current = {
          inLoop: true,
          cooldownUntil: Date.now() + 30000
        };
      }
      
      return true;
    }
  }
  
  // Update last reconnect time
  tracker.lastReconnect = Date.now();
  
  // Not in a loop or cooldown expired
  if (loopStateRef.current) {
    loopStateRef.current = null;
  }
  
  return false;
}

// Type for connection manager
export type ConnectionManager = {
  pendingTimeout: ReturnType<typeof setTimeout> | null,
  isSuspended: boolean
};

/**
 * Creates a delayed connection attempt that respects the mounted state
 */
export function createDelayedConnectionAttempt(
  callback: () => void,
  delay: number,
  isMountedRef: React.MutableRefObject<boolean>,
  connectionManagerRef: React.MutableRefObject<{
    pendingTimeout: ReturnType<typeof setTimeout> | null,
    isSuspended: boolean
  }>
) {
  // Clear any existing timeout
  if (connectionManagerRef.current.pendingTimeout) {
    clearTimeout(connectionManagerRef.current.pendingTimeout);
  }
  
  // Set up new timeout
  connectionManagerRef.current.pendingTimeout = setTimeout(() => {
    connectionManagerRef.current.pendingTimeout = null;
    
    // Only execute if still mounted and not suspended
    if (isMountedRef.current && !connectionManagerRef.current.isSuspended) {
      callback();
    }
  }, delay);
}

/**
 * Temporarily suspends connection attempts
 */
export function suspendConnectionAttempts(
  connectionManagerRef: React.MutableRefObject<{
    pendingTimeout: ReturnType<typeof setTimeout> | null,
    isSuspended: boolean
  }>,
  duration: number = 15000
) {
  // Clear any pending timeout
  if (connectionManagerRef.current.pendingTimeout) {
    clearTimeout(connectionManagerRef.current.pendingTimeout);
    connectionManagerRef.current.pendingTimeout = null;
  }
  
  // Set suspended flag
  connectionManagerRef.current.isSuspended = true;
  
  // Set timeout to clear suspension
  setTimeout(() => {
    connectionManagerRef.current.isSuspended = false;
  }, duration);
}

/**
 * Gets a stable connection state to prevent UI flashing
 */
export function getStableConnectionState(
  newState: 'disconnected' | 'connecting' | 'connected' | 'error',
  stableStateRef: React.MutableRefObject<{
    state: string,
    timestamp: number
  } | null>
): 'disconnected' | 'connecting' | 'connected' | 'error' {
  const now = Date.now();
  
  // Initialize if needed
  if (!stableStateRef.current) {
    stableStateRef.current = {
      state: newState,
      timestamp: now
    };
    return newState;
  }
  
  // Always immediately update to connected state for good UX
  if (newState === 'connected') {
    stableStateRef.current = {
      state: 'connected',
      timestamp: now
    };
    return 'connected';
  }
  
  // For other states, only update if the current state has been stable for at least 3 seconds
  const timeSinceLastUpdate = now - stableStateRef.current.timestamp;
  
  if (timeSinceLastUpdate > 3000 || stableStateRef.current.state === 'disconnected') {
    stableStateRef.current = {
      state: newState,
      timestamp: now
    };
    return newState;
  }
  
  // Otherwise keep the existing state for UI stability
  return stableStateRef.current.state as 'disconnected' | 'connecting' | 'connected' | 'error';
}

/**
 * Gets the effective connection state based on isConnected flag and current state
 */
export function getEffectiveConnectionState(
  state: 'disconnected' | 'connecting' | 'connected' | 'error',
  isConnected: boolean
): 'disconnected' | 'connecting' | 'connected' | 'error' {
  // If isConnected is true, but state isn't 'connected', the state should be 'connected'
  if (isConnected && state !== 'connected') {
    return 'connected';
  }
  
  // If isConnected is false, but state is 'connected', the state should be 'disconnected'
  if (!isConnected && state === 'connected') {
    return 'disconnected';
  }
  
  // Otherwise return the current state
  return state;
}
