
/**
 * State returned by the usePlayerWebSocketNumbers hook
 */
export interface WebSocketNumbersState {
  calledNumbers: number[];
  lastCalledNumber: number | null;
  isConnected: boolean;
  lastUpdateTime: number;
  reconnect: () => void;
}

/**
 * Stored number data format for localStorage
 */
export interface StoredNumberData {
  calledNumbers: number[];
  lastCalledNumber: number | null;
  timestamp: number;
}
