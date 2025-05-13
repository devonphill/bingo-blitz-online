
/**
 * Types for WebSocket service
 */

// Connection status listener type
export type ConnectionListener = (status: string) => void;

// Options for broadcast
export interface BroadcastOptions {
  retries?: number;
  retryDelayMs?: number;
  timeout?: number;
  broadcastId?: string;
}

// Channel configuration
export interface ChannelConfig {
  name: string;
  eventListeners?: Record<string, any>;
}

// WebSocket channel type
export interface WebSocketChannel {
  id: string;
  listeners: any[];
}
