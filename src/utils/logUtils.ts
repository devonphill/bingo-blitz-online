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
 * Global connection registry to prevent multiple instances competing
 */
const connectionRegistry = {
  sessions: new Map<string, Set<string>>(),
  loopDetection: new Map<string, {
    attempts: number,
    lastAttempt: number,
    inLoop: boolean
  }>()
};

/**
 * Cleanup all active connections to reset state
 */
export function cleanupAllConnections() {
  logWithTimestamp("Global connection cleanup: Resetting all connection states");
  connectionRegistry.sessions.clear();
  connectionRegistry.loopDetection.clear();
  logWithTimestamp("All connection states have been reset");
}

/**
 * Register a successful connection to track active instances
 */
export function registerSuccessfulConnection(sessionId: string, instanceId: string) {
  if (!sessionId || !instanceId) return;
  
  if (!connectionRegistry.sessions.has(sessionId)) {
    connectionRegistry.sessions.set(sessionId, new Set());
  }
  
  connectionRegistry.sessions.get(sessionId)?.add(instanceId);
  
  // Reset loop detection state on successful connection
  if (connectionRegistry.loopDetection.has(sessionId)) {
    const loopState = connectionRegistry.loopDetection.get(sessionId);
    if (loopState) {
      loopState.attempts = 0;
      loopState.inLoop = false;
    }
  }
}

/**
 * Unregister a connection instance when component unmounts
 */
export function unregisterConnectionInstance(sessionId: string, instanceId: string) {
  if (!sessionId || !instanceId) return;
  
  if (connectionRegistry.sessions.has(sessionId)) {
    connectionRegistry.sessions.get(sessionId)?.delete(instanceId);
  }
}

/**
 * Prevent connection loops by detecting rapid reconnection attempts
 */
export function preventConnectionLoop(sessionId: string, instanceId: string, stateRef: React.MutableRefObject<any>) {
  if (!sessionId) return false;
  
  const now = Date.now();
  
  if (!connectionRegistry.loopDetection.has(sessionId)) {
    connectionRegistry.loopDetection.set(sessionId, {
      attempts: 1,
      lastAttempt: now,
      inLoop: false
    });
    return false;
  }
  
  const loopState = connectionRegistry.loopDetection.get(sessionId)!;
  
  // If attempts are happening too fast, we might be in a loop
  if (now - loopState.lastAttempt < 2000) {
    loopState.attempts++;
    
    if (loopState.attempts > 5) {
      loopState.inLoop = true;
      
      if (stateRef && stateRef.current !== loopState) {
        stateRef.current = loopState;
      }
      
      logWithTimestamp(`Connection loop detected for session ${sessionId}. Suspending further attempts.`);
      return true;
    }
  } else {
    // Reset counter if attempts are spaced out
    if (now - loopState.lastAttempt > 5000) {
      loopState.attempts = 1;
      loopState.inLoop = false;
    }
  }
  
  loopState.lastAttempt = now;
  
  if (stateRef) {
    stateRef.current = loopState;
  }
  
  return loopState.inLoop;
}

/**
 * Create a delayed connection attempt with proper cleanup
 */
export function createDelayedConnectionAttempt(
  callback: () => void, 
  delay: number,
  isMounted: React.MutableRefObject<boolean>,
  connectionManager: React.MutableRefObject<{
    pendingTimeout: ReturnType<typeof setTimeout> | null,
    isSuspended: boolean
  }>
) {
  // Clear any existing timeout
  if (connectionManager.current.pendingTimeout) {
    clearTimeout(connectionManager.current.pendingTimeout);
    connectionManager.current.pendingTimeout = null;
  }
  
  // Create new timeout
  connectionManager.current.pendingTimeout = setTimeout(() => {
    if (isMounted.current && !connectionManager.current.isSuspended) {
      callback();
    }
    connectionManager.current.pendingTimeout = null;
  }, delay);
}

/**
 * Suspend connection attempts for a period of time
 */
export function suspendConnectionAttempts(
  connectionManager: React.MutableRefObject<{
    pendingTimeout: ReturnType<typeof setTimeout> | null,
    isSuspended: boolean
  }>,
  duration: number = 10000
) {
  // Clear any pending reconnect
  if (connectionManager.current.pendingTimeout) {
    clearTimeout(connectionManager.current.pendingTimeout);
    connectionManager.current.pendingTimeout = null;
  }
  
  // Set suspension flag
  connectionManager.current.isSuspended = true;
  
  // Schedule end of suspension
  setTimeout(() => {
    connectionManager.current.isSuspended = false;
  }, duration);
}

/**
 * Get a stable connection state that won't flicker
 */
export function getStableConnectionState(
  currentState: 'disconnected' | 'connecting' | 'connected' | 'error',
  stateRef: React.MutableRefObject<{
    state: 'disconnected' | 'connecting' | 'connected' | 'error',
    since: number
  } | null>
) {
  const now = Date.now();
  
  // Initialize if not present
  if (!stateRef.current) {
    stateRef.current = {
      state: currentState,
      since: now
    };
    return currentState;
  }
  
  // If transitioning from connected to non-connected, delay the transition
  // to prevent flickering UI
  if (stateRef.current.state === 'connected' && currentState !== 'connected') {
    if (now - stateRef.current.since < 2000) {
      // Keep showing connected for a short period to prevent flickering
      return 'connected';
    }
  }
  
  // If state changed, update the reference
  if (stateRef.current.state !== currentState) {
    stateRef.current = {
      state: currentState,
      since: now
    };
  }
  
  return currentState;
}

/**
 * Get an effective connection state based on multiple factors
 */
export function getEffectiveConnectionState(
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error',
  isConnected: boolean
) {
  if (isConnected) {
    return 'connected';
  }
  
  return connectionState;
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
