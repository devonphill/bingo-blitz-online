
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

/**
 * FIXED: Loop prevention with connection tracking
 * Tracks connection attempts and prevents reconnection loops
 */
export const preventConnectionLoop = (connectionStateRef: { current: any }): boolean => {
  if (!connectionStateRef.current) {
    connectionStateRef.current = {
      attempts: 0,
      lastAttempt: Date.now(),
      inProgress: true,
      cooldownUntil: 0
    };
    return false; // Not in a loop, proceed with connection
  }
  
  const now = Date.now();
  
  // If we're in cooldown, prevent further connections
  if (connectionStateRef.current.cooldownUntil > now) {
    logWithTimestamp(`Connection in cooldown until ${new Date(connectionStateRef.current.cooldownUntil).toISOString()}`);
    return true;
  }
  
  const timeSince = now - connectionStateRef.current.lastAttempt;
  
  // If multiple attempts in less than 2 seconds, might be in a loop
  if (connectionStateRef.current.attempts > 3 && timeSince < 2000) {
    connectionStateRef.current.attempts++;
    connectionStateRef.current.inLoop = true;
    
    // Set a cooldown of 15 seconds
    connectionStateRef.current.cooldownUntil = now + 15000;
    
    logWithTimestamp(`⚠️ Detected potential connection loop after ${connectionStateRef.current.attempts} attempts in ${timeSince}ms - enforcing 15s cooldown`);
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
 * NEW: Simple connection status tracker that prevents rapid state flapping
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
  
  const getStableState = (
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
    
    // If we're seeing rapid state changes, stick with the previous stable state
    // until we've had a consistent new state for the threshold period
    // IMPORTANT: Special case - if new state is 'connected', we allow it immediately
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
  };
  
  return { getStableState };
};

// Adding the missing functions that are being imported
/**
 * Helper function to create a delayed connection attempt
 */
export const createDelayedConnectionAttempt = (
  callback: () => void, 
  delay: number, 
  isMounted: { current: boolean },
  connectionManager: { current: { pendingTimeout: ReturnType<typeof setTimeout> | null } }
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
  connectionManager: { current: { pendingTimeout: ReturnType<typeof setTimeout> | null, isSuspended: boolean } },
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
    connectionManager.current.isSuspended = false;
  }, suspendTimeMs);
  
  logWithTimestamp(`Connection attempts suspended for ${suspendTimeMs}ms`);
};

/**
 * Helper function to get a stable connection state
 */
export const getStableConnectionState = (
  currentState: 'disconnected' | 'connecting' | 'connected' | 'error',
  stableStateRef: { current: any }
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
    
    const delay = Math.min(1000 * Math.pow(2, this._connectionAttempts), 10000);
    logWithTimestamp(`Scheduling reconnect in ${delay}ms (attempt ${this._connectionAttempts}/${this._maxReconnectAttempts})`);
    
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
