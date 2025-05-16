/**
 * WebSocket communication types
 */

// WebSocketConnectionStatus - modified to match CONNECTION_STATES values
export type WebSocketConnectionStatus = 
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'error'
  | 'unknown'
  | 'SUBSCRIBED'
  | 'TIMED_OUT'
  | 'CLOSED'
  | 'CHANNEL_ERROR'
  | 'CONNECTING'
  | 'JOINED'
  | 'JOINING';

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
