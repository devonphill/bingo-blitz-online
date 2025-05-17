
export interface CalledNumbersState {
  calledNumbers: number[];
  lastCalledNumber: number | null;
  lastUpdateTime: number;
  timestamp: number; // Added timestamp property
}

export interface NumberCalledPayload {
  number: number;
  calledNumbers?: number[];
  sessionId?: string;
  timestamp?: number;
}

export interface PlayerTicketState {
  id: string;
  serial: string;
  perm: number;
  position: number;
  layout_mask: number;
  numbers: number[][];
  marked: boolean[][];
  markedPositions?: { row: number; col: number }[]; // Added markedPositions property
}
