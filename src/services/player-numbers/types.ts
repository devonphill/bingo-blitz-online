
/**
 * Player numbers service types
 */

// Number update callback type
export type NumberUpdateCallback = (number: number, allNumbers: number[]) => void;

// Session subscription options
export interface SessionSubscriptionOptions {
  enableLocalStorage?: boolean;
  enableDatabaseFallback?: boolean;
}

// Stored number data interface
export interface StoredNumberData {
  sessionId: string;
  calledNumbers: number[];
  lastCalledNumber: number | null;
  timestamp: string;
  broadcastId?: string;
  synced?: boolean;
}

// Number broadcast payload
export interface NumberBroadcastPayload {
  number?: number;
  sessionId: string;
  lastCalledNumber?: number;
  calledNumbers?: number[];
  timestamp: string;
  broadcastId?: string;
}
