
// WebSocket channel configuration
export interface ChannelConfig {
  broadcast?: {
    self?: boolean;
    ack?: boolean;
  };
}

// WebSocket channel
export interface WebSocketChannel {
  subscribe: (callback?: (status: string) => void) => any;
  on: (event: string, config: any, callback: (payload: any) => void) => any;
  send: (event: string, payload: any) => Promise<any>;
}

// Broadcast options
export interface BroadcastOptions {
  retries?: number;
  retryDelay?: number;
}

// Connection listener
export interface ConnectionListener {
  (status: string): void;
}

// Session state update
export interface SessionStateUpdate {
  id: string;
  status: string;
  lifecycle_state: string;
  [key: string]: any;
}

// WebSocket status constants
export const WEBSOCKET_STATUS = {
  SUBSCRIBED: 'SUBSCRIBED',
  TIMED_OUT: 'TIMED_OUT',
  CLOSED: 'CLOSED',
  CHANNEL_ERROR: 'CHANNEL_ERROR',
  JOINED: 'JOINED',
  JOINING: 'JOINING',
  LEAVING: 'LEAVING'
};

// Channel names constants
export const CHANNEL_NAMES = {
  GAME_UPDATES: 'game-updates',
  PLAYER_PRESENCE: 'player-presence',
  SESSION_EVENTS: 'session-events'
};

// Event types constants
export const EVENT_TYPES = {
  NUMBER_CALLED: 'number-called',
  GAME_RESET: 'game-reset',
  CLAIM_SUBMITTED: 'claim-submitted',
  CLAIM_VALIDATION: 'claim-validation',
  CLAIM_VALIDATING_TKT: 'claim-validating-ticket',
  PATTERN_CHANGE: 'pattern-change',
  GAME_CHANGE: 'game-change',
  SESSION_COMPLETE: 'session-complete'
};
