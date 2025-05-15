
export type ClaimStatus = 'pending' | 'verified' | 'rejected' | 'paid_out';

export interface ClaimData {
  id: string;
  playerId: string;
  playerName?: string;
  playerCode?: string;
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
  ticketSerial?: string;
  gameType?: string;
  calledNumbers?: number[];
  lastCalledNumber?: number | null;
  hasLastCalledNumber?: boolean;
  winPattern?: string;
  patternClaimed?: string;
  status: ClaimStatus;
  timestamp: string;
  claimedAt?: string;
  verifiedAt?: string;
  verifiedById?: string;
  verificationNotes?: string;
  toGoCount?: number;
  gameNumber?: number;
}

export interface ClaimResult {
  sessionId: string;
  playerId: string;
  playerName?: string;
  result: 'valid' | 'rejected';
  timestamp: string;
  ticket?: any; // This should include the full ticket data
  message?: string;
}
