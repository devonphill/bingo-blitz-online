
/**
 * WebSocket Types
 */

// Channel Names
export const CHANNEL_NAMES = {
  GAME_UPDATES: 'game-updates'
};

// Event Types
export const EVENT_TYPES = {
  NUMBER_CALLED: 'number-called',
  CLAIM_SUBMITTED: 'claim-submitted',
  CLAIM_VALIDATED: 'claim-validated',
  GAME_STATE_UPDATE: 'game-state-update'
};

// WebSocket Status
export const WEBSOCKET_STATUS = {
  CONNECTED: 'CONNECTED',
  CONNECTING: 'CONNECTING',
  DISCONNECTED: 'DISCONNECTED',
  CHANNEL_ERROR: 'CHANNEL_ERROR'
};

// Interface for channel config
export interface ChannelConfig {
  config?: {
    broadcast?: {
      self?: boolean;
      ack?: boolean;
    };
  };
}

// Interface for WebSocket channel
export interface WebSocketChannel {
  on: (event: string, options: any, callback: (payload: any) => void) => WebSocketChannel;
  subscribe: (callback?: (status: string) => void) => WebSocketChannel;
  send: (payload: any) => Promise<any>;
}

// Interface for broadcast options
export interface BroadcastOptions {
  retries?: number;
  retryDelay?: number;
}

// Interface for connection listener
export type ConnectionListener = (status: string) => void;

// Interface for session state update
export interface SessionStateUpdate {
  id: string;
  status: string;
  lifecycle_state: string;
  current_game?: number;
  updated_at: string;
}
