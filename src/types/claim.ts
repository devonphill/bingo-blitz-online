
/**
 * Standard claim status types used throughout the application
 */
export type ClaimStatus = 'none' | 'pending' | 'valid' | 'invalid' | 'validating' | 'validated' | 'rejected';

export interface ClaimData {
  id: string;
  sessionId: string;
  playerId: string;
  playerName?: string;
  timestamp: number | string;
  toGoCount?: number;
  gameType?: string;
  gameNumber?: number;
  winPattern?: string;
  ticket?: any;
  calledNumbers?: number[];
  lastCalledNumber?: number;
  hasLastCalledNumber?: boolean;
  status?: ClaimStatus;
}

export interface ClaimResult {
  sessionId: string;
  playerId: string;
  playerName?: string;
  result: 'valid' | 'rejected';
  ticket?: any;
  timestamp?: string;
}
