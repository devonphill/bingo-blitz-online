
/**
 * WebSocket service types
 */

// Channel configuration
export interface ChannelConfig {
  config?: {
    broadcast?: {
      self?: boolean;
      ack?: boolean;
    };
    presence?: {
      key?: string;
    };
  };
}

// WebSocket channel interface
export interface WebSocketChannel {
  on: (eventType: string, event: { event: string }, callback: (payload: any) => void) => void;
  subscribe: (callback?: (status: string) => void) => void;
}

// Broadcast options
export interface BroadcastOptions {
  retries?: number;
  retryDelay?: number;
  retryMultiplier?: number;
  timeout?: number;
}

// Connection listener type
export type ConnectionListener = (status: string) => void;

