
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
