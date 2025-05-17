
// Define WebSocket connection states
export const CONNECTION_STATES = {
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting'
} as const;

// Connection status type
export type WebSocketConnectionStatus = typeof CONNECTION_STATES[keyof typeof CONNECTION_STATES];

// Channel name constants
export const CHANNEL_NAMES = {
  GAME_UPDATES_BASE: 'game-updates-for-session-',
  CLAIM_UPDATES_BASE: 'claim-updates-for-session-'
} as const;

// Event types
export const EVENT_TYPES = {
  // Game events
  NUMBER_CALLED: 'number-called',
  GAME_STATE_UPDATE: 'game-state-update',
  GAME_RESET: 'game-reset',
  WIN_PATTERN_UPDATED: 'win-pattern-updated',
  
  // Claim events
  CLAIM_SUBMITTED: 'claim-submitted',
  CLAIM_VALIDATING: 'claim-validating',
  CLAIM_VALIDATING_TKT: 'claim-validating-tkt',
  CLAIM_RESOLUTION: 'claim-resolution',
  
  // Player events
  PLAYER_JOIN: 'player-join',
  PLAYER_LEAVE: 'player-leave',
  PLAYER_PRESENCE_UPDATE: 'player-presence-update'
} as const;

// Event type constants
export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

// Channel name constants
export type ChannelNameKey = keyof typeof CHANNEL_NAMES;
