
/**
 * WebSocket communication types
 */

// WebSocketConnectionStatus - derived from CONNECTION_STATES values
export type WebSocketConnectionStatus = 
  | 'connected'
  | 'connecting'
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
  calledNumbers?: number[];
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
