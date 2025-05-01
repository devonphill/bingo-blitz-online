
/**
 * Helper function for consistent timestamped logging
 */
import React from 'react';

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

// Create a global connection tracker to prevent multiple instances from reconnecting
// This is a singleton that tracks connections across the entire app
const globalConnectionTracker: {
  [sessionId: string]: {
    lastAttempt: number;
    attempts: number;
    cooldownUntil: number;
    activeInstances: Set<string>;
  };
} = {};

/**
 * IMPROVED: Loop prevention with global connection tracking
 * Tracks connection attempts across all hooks to prevent reconnection loops
 */
export const preventConnectionLoop = (
  sessionId: string,
  instanceId: string,
  connectionStateRef: React.MutableRefObject<any>
): boolean => {
  const now = Date.now();
  
  // Initialize session tracker if it doesn't exist
  if (!globalConnectionTracker[sessionId]) {
    globalConnectionTracker[sessionId] = {
      lastAttempt: now,
      attempts: 0,
      cooldownUntil: 0,
      activeInstances: new Set([instanceId])
    };
    
    // Initialize local state
    if (!connectionStateRef.current) {
      connectionStateRef.current = {
        attempts: 0,
        lastAttempt: now,
        inProgress: true,
        cooldownUntil: 0
      };
    }
    
    return false; // Allow first connection attempt
  }

  // Register this instance
  globalConnectionTracker[sessionId].activeInstances.add(instanceId);
  
  // If we're in cooldown, prevent further connections
  if (globalConnectionTracker[sessionId].cooldownUntil > now) {
    logWithTimestamp(`Session ${sessionId} in global cooldown until ${new Date(globalConnectionTracker[sessionId].cooldownUntil).toISOString()}`);
    
    // Update local state to match global state
    connectionStateRef.current = {
      attempts: globalConnectionTracker[sessionId].attempts,
      lastAttempt: globalConnectionTracker[sessionId].lastAttempt,
      inProgress: false,
      cooldownUntil: globalConnectionTracker[sessionId].cooldownUntil
    };
    
    return true; // Prevent connection
  }
  
  // Count active instances - CRITICAL FIX: make sure we correctly count active instances
  const instanceCount = globalConnectionTracker[sessionId].activeInstances.size;
  
  // If we have multiple instances or rapid reconnects, we're likely in a loop
  if ((instanceCount > 1) ||
      (globalConnectionTracker[sessionId].attempts > 3 && (now - globalConnectionTracker[sessionId].lastAttempt) < 5000)) {
    
    globalConnectionTracker[sessionId].attempts++;
    // CRITICAL FIX: Extended cooldown to 30 seconds when multiple instances are detected
    const cooldownDuration = instanceCount > 2 ? 30000 : 15000; // 30s cooldown for 3+ instances, 15s for 2 instances
    globalConnectionTracker[sessionId].cooldownUntil = now + cooldownDuration;
    
    // Update local state
    connectionStateRef.current = {
      attempts: globalConnectionTracker[sessionId].attempts,
      lastAttempt: now,
      inProgress: false,
      cooldownUntil: globalConnectionTracker[sessionId].cooldownUntil,
      inLoop: true
    };
    
    logWithTimestamp(`⚠️ Detected connection loop for session ${sessionId} with ${instanceCount} active instances - enforcing ${cooldownDuration/1000}s cooldown`);
    return true; // Prevent connection
  }
  
  // Update global connection state
  globalConnectionTracker[sessionId].attempts++;
  globalConnectionTracker[sessionId].lastAttempt = now;
  
  // Update local connection state
  connectionStateRef.current = {
    attempts: globalConnectionTracker[sessionId].attempts,
    lastAttempt: now,
    inProgress: true,
    inLoop: false,
    cooldownUntil: 0
  };
  
  return false; // Allow connection
};

/**
 * Handle successful connection by resetting attempt counters
 */
export const registerSuccessfulConnection = (
  sessionId: string,
  instanceId: string
): void => {
  if (globalConnectionTracker[sessionId]) {
    // Reset attempt counter but keep tracking the instance
    globalConnectionTracker[sessionId].attempts = 0;
    globalConnectionTracker[sessionId].cooldownUntil = 0;
    logWithTimestamp(`Connection successful for session ${sessionId}, instance ${instanceId} - resetting counters`);
  }
};

/**
 * Clean up instance tracking when component unmounts
 */
export const unregisterConnectionInstance = (
  sessionId: string,
  instanceId: string
): void => {
  if (globalConnectionTracker[sessionId]) {
    globalConnectionTracker[sessionId].activeInstances.delete(instanceId);
    logWithTimestamp(`Unregistered instance ${instanceId} from session ${sessionId} - remaining instances: ${globalConnectionTracker[sessionId].activeInstances.size}`);
    
    // If no more instances, clean up the session entry
    if (globalConnectionTracker[sessionId].activeInstances.size === 0) {
      delete globalConnectionTracker[sessionId];
      logWithTimestamp(`Removed session ${sessionId} from global connection tracker - no more active instances`);
    }
  }
};

/**
 * Simple connection status tracker that prevents rapid state flapping
 */
export const useStableConnectionState = () => {
  const stableStateRef = React.useRef<{
    state: 'disconnected' | 'connecting' | 'connected' | 'error',
    since: number,
    changeCount: number
  }>({
    state: 'disconnected',
    since: Date.now(),
    changeCount: 0
  });
  
  const getStableState = React.useCallback((
    currentState: 'disconnected' | 'connecting' | 'connected' | 'error', 
    stabilityThresholdMs: number = 5000
  ): 'disconnected' | 'connecting' | 'connected' | 'error' => {
    const now = Date.now();
    
    // If state hasn't changed, return stable state
    if (stableStateRef.current.state === currentState) {
      return currentState;
    }
    
    // State has changed - increment counter
    stableStateRef.current.changeCount++;
    
    // Special case - if new state is 'connected', we allow it immediately
    if (currentState === 'connected') {
      stableStateRef.current = {
        state: currentState,
        since: now,
        changeCount: 0
      };
      return currentState;
    }
    
    // For other states, apply stabilization
    if (stableStateRef.current.changeCount > 3 && 
        now - stableStateRef.current.since < stabilityThresholdMs) {
      logWithTimestamp(`Suppressing connection state flapping: actual=${currentState}, reported=${stableStateRef.current.state}`);
      return stableStateRef.current.state;
    }
    
    // Update to new stable state
    stableStateRef.current = {
      state: currentState,
      since: now,
      changeCount: 0
    };
    
    return currentState;
  }, []);
  
  return { getStableState };
};

/**
 * Helper function to create a delayed connection attempt
 */
export const createDelayedConnectionAttempt = (
  callback: () => void, 
  delay: number, 
  isMounted: React.MutableRefObject<boolean>,
  connectionManager: React.MutableRefObject<{ 
    pendingTimeout: ReturnType<typeof setTimeout> | null,
    isSuspended: boolean
  }>
) => {
  // Clear any existing timeout
  if (connectionManager.current.pendingTimeout) {
    clearTimeout(connectionManager.current.pendingTimeout);
    connectionManager.current.pendingTimeout = null;
  }
  
  // Set new timeout
  connectionManager.current.pendingTimeout = setTimeout(() => {
    connectionManager.current.pendingTimeout = null;
    if (isMounted.current) {
      callback();
    }
  }, delay);
};

/**
 * Helper function to suspend connection attempts
 */
export const suspendConnectionAttempts = (
  connectionManager: React.MutableRefObject<{ 
    pendingTimeout: ReturnType<typeof setTimeout> | null, 
    isSuspended: boolean 
  }>,
  suspendTimeMs: number
) => {
  // Clear any pending timeouts
  if (connectionManager.current.pendingTimeout) {
    clearTimeout(connectionManager.current.pendingTimeout);
    connectionManager.current.pendingTimeout = null;
  }
  
  // Set suspension
  connectionManager.current.isSuspended = true;
  
  // Create timeout to clear suspension
  setTimeout(() => {
    if (connectionManager && connectionManager.current) {
      connectionManager.current.isSuspended = false;
    }
  }, suspendTimeMs);
  
  logWithTimestamp(`Connection attempts suspended for ${suspendTimeMs}ms`);
};

/**
 * Helper function to get a stable connection state
 */
export const getStableConnectionState = (
  currentState: 'disconnected' | 'connecting' | 'connected' | 'error',
  stableStateRef: React.MutableRefObject<any>
): 'disconnected' | 'connecting' | 'connected' | 'error' => {
  const now = Date.now();
  
  // Initialize if needed
  if (!stableStateRef.current) {
    stableStateRef.current = {
      state: currentState,
      since: now,
      changeCount: 0
    };
    return currentState;
  }
  
  // If state hasn't changed, return stable state
  if (stableStateRef.current.state === currentState) {
    return currentState;
  }
  
  // State has changed - increment counter
  stableStateRef.current.changeCount = (stableStateRef.current.changeCount || 0) + 1;
  
  // If new state is 'connected', allow it immediately
  if (currentState === 'connected') {
    stableStateRef.current = {
      state: currentState,
      since: now,
      changeCount: 0
    };
    return currentState;
  }
  
  // For other states, apply stabilization
  if (stableStateRef.current.changeCount > 3 && 
      now - stableStateRef.current.since < 5000) {
    logWithTimestamp(`Suppressing connection state flapping: actual=${currentState}, reported=${stableStateRef.current.state}`);
    return stableStateRef.current.state;
  }
  
  // Update to new stable state
  stableStateRef.current = {
    state: currentState,
    since: now,
    changeCount: 0
  };
  
  return currentState;
};

/**
 * Helper function to get the effective connection state
 */
export const getEffectiveConnectionState = (
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error',
  isConnected: boolean
): 'disconnected' | 'connecting' | 'connected' | 'error' => {
  // If we're marked as connected but the state doesn't reflect this, update the state
  if (isConnected && connectionState !== 'connected') {
    return 'connected';
  }
  
  // If we're marked as disconnected but the state is connected, update to reflect reality
  if (!isConnected && connectionState === 'connected') {
    return 'disconnected';
  }
  
  return connectionState;
};

// Additional helper to manage connection attempts with cooldown
export class ConnectionManager {
  private _isConnecting: boolean = false;
  private _cooldownUntil: number = 0;
  private _reconnectTimer: NodeJS.Timeout | null = null;
  private _lastConnectionAttempt: number = 0;
  private _connectionAttempts: number = 0;
  private _maxReconnectAttempts: number = 5;
  
  constructor(maxReconnectAttempts: number = 5) {
    this._maxReconnectAttempts = maxReconnectAttempts;
  }
  
  public get isConnecting(): boolean {
    return this._isConnecting;
  }
  
  public get isInCooldown(): boolean {
    return Date.now() < this._cooldownUntil;
  }
  
  public get remainingCooldown(): number {
    const remaining = this._cooldownUntil - Date.now();
    return remaining > 0 ? remaining : 0;
  }
  
  public get connectionAttempts(): number {
    return this._connectionAttempts;
  }
  
  public startConnection(): boolean {
    if (this.isConnecting || this.isInCooldown) {
      return false;
    }
    
    this._isConnecting = true;
    this._lastConnectionAttempt = Date.now();
    this._connectionAttempts++;
    
    return true;
  }
  
  public endConnection(success: boolean): void {
    this._isConnecting = false;
    
    if (success) {
      // Reset connection attempts on success
      this._connectionAttempts = 0;
    }
    else if (this._connectionAttempts >= this._maxReconnectAttempts) {
      // Set cooldown if max attempts reached
      this._cooldownUntil = Date.now() + 20000; // 20 second cooldown
      logWithTimestamp(`Max reconnect attempts (${this._maxReconnectAttempts}) reached. Cooldown for 20 seconds.`);
      this._connectionAttempts = 0;
    }
  }
  
  public scheduleReconnect(callback: () => void): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
    }
    
    if (this._connectionAttempts >= this._maxReconnectAttempts) {
      this.endConnection(false);
      return;
    }
    
    const delay = Math.min(1000 * Math.pow(2, this._connectionAttempts), 10000); // Exponential backoff with 10s max
    logWithTimestamp(`Scheduling reconnect in ${delay/1000}s (attempt ${this._connectionAttempts}/${this._maxReconnectAttempts})...`);
    
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (!this.isInCooldown) {
        callback();
      }
    }, delay);
  }
  
  public reset(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._connectionAttempts = 0;
    this._isConnecting = false;
    this._cooldownUntil = 0;
  }
  
  public forceReconnect(): void {
    this.reset();
  }
}

/**
 * CRITICAL FIX: Force clean up ALL connection instances on page load/route change
 */
export const cleanupAllConnections = () => {
  logWithTimestamp("Global connection cleanup: Resetting all connection states");
  for (const sessionId in globalConnectionTracker) {
    delete globalConnectionTracker[sessionId];
  }
};

// Global cleanup on module load
cleanupAllConnections();
