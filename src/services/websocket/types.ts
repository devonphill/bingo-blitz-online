
export interface WebSocketChannelStatus {
  status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'SUBSCRIPTION_ERROR' | 'TIMED_OUT';
  error?: any;
}

export interface SessionStateUpdate {
  id: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  lifecycle_state: 'setup' | 'lobby' | 'live' | 'completed';
  name: string;
  game_type: string;
  current_game: number;
  number_of_games: number;
}

export interface NumberCalledEvent {
  sessionId: string;
  number: number;
  timestamp: number;
  callSequence: number[];
}

export interface NumberClearEvent {
  sessionId: string;
  timestamp: number;
}

export interface GameStateChangeEvent {
  sessionId: string;
  newState: string;
  timestamp: number;
}
