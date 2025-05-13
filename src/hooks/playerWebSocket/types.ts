
/**
 * Types for WebSocket-based player number hooks
 */

export interface WebSocketNumbersState {
  calledNumbers: number[];
  lastCalledNumber: number | null;
  isConnected: boolean;
  lastUpdateTime: number;
  reconnect: () => void;
}

export interface StoredNumberData {
  sessionId: string;
  calledNumbers: number[];
  lastCalledNumber: number | null;
  timestamp: string;
}
