
/**
 * State returned by the usePlayerWebSocketNumbers hook
 */
export interface WebSocketNumbersState {
  calledNumbers: number[];
  lastCalledNumber: number | null;
  currentNumber?: number | null; // Add property used in PlayerGame.tsx
  numberCallTimestamp?: number | null; // Add property used in PlayerGame.tsx
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
