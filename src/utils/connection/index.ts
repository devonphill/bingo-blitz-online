
export * from './ConnectionHeartbeat';
export * from './ConnectionListenerManager';
export * from './connectionTypes';

// Add universal connection utilities
export const WEBSOCKET_EVENTS = {
  CLAIM_SUBMITTED: 'claim-submitted',
  CLAIM_VALIDATED: 'claim-validated',
  NUMBER_CALLED: 'number-called',
  GAME_STATE_CHANGED: 'game-state-changed',
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left'
};

export const WEBSOCKET_CHANNELS = {
  GAME_UPDATES: 'game-updates',
  CLAIM_CHECKING: 'claim_checking_broadcaster',
  PRESENCE: 'presence'
};
