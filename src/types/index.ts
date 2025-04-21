
export type UserRole = 'superuser' | 'subuser';

export interface User {
  id: string;
  username: string;
  role: UserRole;
}

export type GameType = '90-ball' | '80-ball' | 'quiz' | 'music' | 'logo';

export interface GameSession {
  id: string;
  name: string;
  gameType: GameType;
  createdBy: string;
  accessCode: string;
  status: 'pending' | 'active' | 'completed';
  createdAt: string;
}

export interface Player {
  id: string;
  sessionId: string;
  nickname: string;
  joinedAt: string;
}

export interface BingoCell {
  number: number | null;
  marked: boolean;
}

export interface BingoCard {
  id: string;
  playerId: string;
  cells: BingoCell[][];
}

export interface BingoCaller {
  sessionId: string;
  calledNumbers: number[];
  currentNumber: number | null;
}
