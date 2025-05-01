
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

/**
 * Type for connection manager reference
 */
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

/**
 * Enhanced ConnectionManager class to handle connection state more effectively
 */
export class ConnectionManagerClass {
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  private _isConnecting: boolean = false;
  private _isInCooldown: boolean = false;
  private cooldownUntil: number = 0;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  
  constructor(private backoffFactor: number = 2) {}
  
  /**
   * Indicates if a connection attempt is currently in progress
   */
  get isConnecting(): boolean {
    return this._isConnecting;
  }
  
  /**
   * Indicates if we're currently in a cooldown period between connection attempts
   */
  get isInCooldown(): boolean {
    if (!this._isInCooldown) return false;
    
    // Check if cooldown has expired
    if (Date.now() > this.cooldownUntil) {
      this._isInCooldown = false;
      return false;
    }
    
    return true;
  }
  
  /**
   * Start a new connection attempt
   */
  startConnection(): boolean {
    // Don't start if already connecting or in cooldown
    if (this._isConnecting) {
      logWithTimestamp("Connection attempt already in progress");
      return false;
    }
    
    if (this.isInCooldown) {
      const remainingCooldown = Math.ceil((this.cooldownUntil - Date.now()) / 1000);
      logWithTimestamp(`In cooldown period, ${remainingCooldown}s remaining before next attempt`);
      return false;
    }
    
    this._isConnecting = true;
    return true;
  }
  
  /**
   * Signal end of a connection attempt
   */
  endConnection(success: boolean): void {
    this._isConnecting = false;
    
    if (success) {
      // Reset reconnect attempts on success
      this.reconnectAttempts = 0;
      return;
    }
    
    // Increment failed attempt counter
    this.reconnectAttempts++;
    
    // Set cooldown if we've had too many failed attempts
    if (this.reconnectAttempts > 3) {
      const cooldownMs = Math.min(30000, 1000 * Math.pow(this.backoffFactor, this.reconnectAttempts - 3));
      this._isInCooldown = true;
      this.cooldownUntil = Date.now() + cooldownMs;
      logWithTimestamp(`Setting reconnect cooldown for ${cooldownMs}ms after ${this.reconnectAttempts} failed attempts`);
    }
    
    // Give up after max attempts
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      logWithTimestamp(`Giving up after ${this.maxReconnectAttempts} failed connection attempts`);
    }
  }
  
  /**
   * Reset connection state and attempt counter
   */
  reset(): void {
    this._isConnecting = false;
    this._isInCooldown = false;
    this.reconnectAttempts = 0;
    this.cooldownUntil = 0;
    
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
  }
  
  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  scheduleReconnect(callback: () => void): void {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
    }
    
    // Calculate backoff delay
    const baseDelay = 1000; // Start with 1 second
    const maxDelay = 30000; // Cap at 30 seconds
    const delay = Math.min(maxDelay, baseDelay * Math.pow(this.backoffFactor, this.reconnectAttempts));
    
    logWithTimestamp(`Scheduling reconnect attempt in ${delay}ms`);
    
    this.pendingTimeout = setTimeout(() => {
      this.pendingTimeout = null;
      this._isInCooldown = false;
      callback();
    }, delay);
  }
  
  /**
   * Force an immediate reconnection regardless of cooldown
   */
  forceReconnect(): void {
    this._isConnecting = false;
    this._isInCooldown = false;
    this.cooldownUntil = 0;
    
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
  }
}

