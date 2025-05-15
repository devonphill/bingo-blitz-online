
export type ClaimStatus = 'pending' | 'valid' | 'rejected';

export interface ClaimData {
  id: string;
  playerId: string;
  playerName?: string;
  sessionId: string;
  ticket?: {
    serial: string;
    perm?: number;
    position?: number;
    layoutMask?: number;
    layout_mask?: number;
    numbers?: number[];
    calledNumbers?: number[];
  };
  gameType?: string;
  calledNumbers?: number[];
  lastCalledNumber?: number | null;
  hasLastCalledNumber?: boolean;
  winPattern?: string;
  status: ClaimStatus;
  timestamp: string;
  toGoCount?: number;
  gameNumber?: number;
}

export interface ClaimResult {
  sessionId: string;
  playerId: string;
  playerName?: string;
  result: 'valid' | 'rejected';
  timestamp: string;
  ticket?: any;
  message?: string;
}
