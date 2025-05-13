
/**
 * WebSocket Constants
 * This file contains standardized channel names and event types for WebSocket communication
 */

// Primary channel name used for all game-related WebSocket communications
export const CHANNEL_NAMES = {
  GAME_UPDATES: 'game-updates'
};

// Event types for different message types
export const EVENT_TYPES = {
  // Caller -> Player events
  NUMBER_CALLED: 'number-called',
  CLAIM_VALIDATION: 'claim-validation',
  CLAIM_VALIDATING_TKT: 'claim-validating-ticket',
  GAME_STATE_UPDATE: 'game-state-update',
  GAME_RESET: 'game-reset',
  
  // Player -> Caller events
  CLAIM_SUBMITTED: 'claim-submitted',
  PLAYER_NAME: 'player-name',
};

// Connection states
export const CONNECTION_STATES = {
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  UNKNOWN: 'unknown'
};

// WebSocket status
export const WEBSOCKET_STATUS = {
  SUBSCRIBED: 'SUBSCRIBED',
  CLOSED: 'CLOSED',
  CHANNEL_ERROR: 'CHANNEL_ERROR',
  TIMED_OUT: 'TIMED_OUT',
  JOINED: 'JOINED',
  JOINING: 'JOINING'
};
