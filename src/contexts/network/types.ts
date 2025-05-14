
export type ConnectionState = 'connected' | 'connecting' | 'disconnected';

export interface GameStateUpdatePayload {
  sessionId: string;
  gameNumber: number;
  maxGameNumber: number;
  gameType: string;
  calledNumbers: number[];
  lastCalledNumber: number | null;
  currentWinPattern: string | null;
  currentPrize: string | null;
  gameStatus: string;
}

export interface NetworkContextType {
  connectionState: ConnectionState;
  isConnected: boolean;
  lastPingTime: number | null;
  sessionId: string | null;
  connect: (sessionId: string) => void;
  callNumber: (number: number, sessionId?: string) => Promise<boolean>;
  fetchClaims: (sessionId?: string) => Promise<any[]>;
  updatePlayerPresence: (playerInfo: any) => Promise<boolean>;
  addGameStateUpdateListener: (callback: (gameState: GameStateUpdatePayload) => void) => (() => void);
  addConnectionStatusListener: (callback: (isConnected: boolean) => void) => (() => void);
  addNumberCalledListener: (callback: (number: number | null, calledNumbers: number[]) => void) => (() => void);
  submitBingoClaim: (ticket: any, playerCode: string, sessionId: string) => boolean;
  validateClaim: (claim: any, isValid: boolean) => Promise<boolean>;
}
