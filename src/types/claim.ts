
/**
 * Types related to bingo claims
 */

export interface ClaimData {
  id: string;
  timestamp: string;
  sessionId: string;
  playerId: string;
  playerName?: string;
  gameType?: string;
  winPattern?: string;
  gameNumber?: number;
  toGoCount?: number;
  ticket?: TicketData;
  status: 'pending' | 'valid' | 'invalid' | 'rejected';
  lastCalledNumber?: number | null;
}

export interface TicketData {
  serial: string;
  perm: number;
  position: number;
  layoutMask: number;
  numbers: number[];
  calledNumbers?: number[];
}

export interface ClaimResult {
  sessionId: string;
  playerId: string;
  playerName: string;
  result: 'valid' | 'invalid' | 'rejected';
  timestamp: string;
  ticket?: Partial<TicketData>;
}
