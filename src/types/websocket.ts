
/**
 * WebSocket communication types
 */

// WebSocket connection status
export type WebSocketConnectionStatus = 
  | 'SUBSCRIBED'
  | 'TIMED_OUT'
  | 'CLOSED'
  | 'CHANNEL_ERROR'
  | 'CONNECTING'
  | 'JOINED'
  | 'JOINING'
  | 'disconnected'
  | 'error'
  | 'unknown';

// WebSocket event payload
export interface WebSocketEventPayload<T = any> {
  type: string;
  event: string;
  payload: T;
}

// Standard number called payload
export interface NumberCalledPayload {
  number: number;
  sessionId: string;
  timestamp: number;
  broadcastId?: string;
}

// Standard claim submitted payload
export interface ClaimSubmittedPayload {
  claimId: string;
  playerId: string;
  playerName: string;
  sessionId: string;
  timestamp: number;
}

