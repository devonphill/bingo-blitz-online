
/**
 * Type definitions for network context
 */

// Export the ConnectionState type for use in other components
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error' | 'unknown';

// Interface for all required methods in the network context
export interface NetworkContextType {
  connectionState: ConnectionState;
  isConnected: boolean;
  lastPingTime: number | null;
  sessionId: string | null;  
  connect: (sessionId: string) => void;
  callNumber: (number: number, sessionId?: string) => Promise<boolean>;
  fetchClaims: (sessionId?: string) => Promise<any[]>;
  updatePlayerPresence: (presenceData: any) => Promise<boolean>;
  addGameStateUpdateListener: (callback: (gameState: any) => void) => () => void;
  addConnectionStatusListener: (callback: (isConnected: boolean) => void) => () => void;
  addNumberCalledListener: (callback: (number: number | null, calledNumbers: number[]) => void) => () => void;
  submitBingoClaim: (ticket: any, playerCode: string, sessionId: string) => boolean;
  validateClaim: (claim: any, isValid: boolean) => Promise<boolean>;
}

// Game state update payload type
export interface GameStateUpdatePayload {
  sessionId: string;
  gameNumber: number;
  maxGameNumber: number;
  gameType: string;
  calledNumbers: number[];
  lastCalledNumber: number | null;
  currentWinPattern: string;
  currentPrize: string;
  gameStatus: string;
}
