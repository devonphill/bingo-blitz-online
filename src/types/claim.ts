
export type ClaimStatus = 'pending' | 'verified' | 'rejected' | 'paid_out';

export interface ClaimData {
  id: string;
  playerId: string;
  playerName?: string;
  playerCode?: string;
  sessionId: string;
  
  // Database field equivalents
  player_id?: string;
  player_name?: string;
  player_code?: string;
  session_id?: string;
  
  ticket?: {
    serial: string;
    perm?: number;
    position?: number;
    layoutMask?: number;
    layout_mask?: number;
    numbers?: number[];
    calledNumbers?: number[];
  };
  ticket_details?: any; // For DB field
  ticket_serial?: string; // For DB field
  ticketSerial?: string;
  
  gameType?: string;
  calledNumbers?: number[];
  called_numbers_snapshot?: number[];
  lastCalledNumber?: number | null;
  hasLastCalledNumber?: boolean;
  
  winPattern?: string;
  patternClaimed?: string;
  pattern_claimed?: string;
  
  status: ClaimStatus;
  timestamp: string;
  claimed_at?: string;
  claimedAt?: string;
  verifiedAt?: string;
  verified_at?: string;
  verifiedById?: string;
  verified_by_user_id?: string;
  verificationNotes?: string;
  verification_notes?: string;
  
  toGoCount?: number;
  gameNumber?: number;
  game_number?: number;
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
