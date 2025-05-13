
/**
 * Connection management constants
 */

// Time constants
export const CONNECTION_TIMEOUT = 10000; // 10 seconds
export const HEARTBEAT_INTERVAL = 30000; // 30 seconds
export const RECONNECT_BASE_DELAY = 1000; // 1 second base delay
export const MAX_RECONNECT_ATTEMPTS = 10;
export const MAX_RECONNECT_DELAY = 10000; // 10 seconds

// Connection state types
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error' | 'unknown';
