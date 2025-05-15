
export interface Winline {
  id: number;
  name: string;
  active: boolean;
}

export interface BingoTicket {
  id?: string;
  serial: string;
  perm: number;
  position?: number;
  layout_mask: number;
  numbers: number[];
  is_winning?: boolean;
  to_go?: number;
}

export interface BingoClaim {
  id: string;
  playerId: string;
  playerName: string;
  sessionId: string;
  ticket: BingoTicket;
  gameType: string;
  timestamp: string;
  status: 'pending' | 'valid' | 'invalid';
  calledNumbers?: number[];
  lastCalledNumber?: number | null;
}
