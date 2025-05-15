
import { createContext, useContext } from 'react';
import { GameStatus } from '@/types/game';

// Create a context with default values
interface GameDataContextType {
  sessionId: string;
  gameId: number | null;
  gameStatus: GameStatus | null;
  lastCalledNumber: number | null;
  calledNumbers: number[];
  winPatterns: any[];
  currentWinPattern: any | null;
  isGameActive: boolean;
  isGameComplete: boolean;
  gameTitle?: string | null;
  gameType?: string | null;
}

export const GameDataContext = createContext<GameDataContextType>({
  sessionId: '',
  gameId: null, 
  gameStatus: null,
  lastCalledNumber: null,
  calledNumbers: [],
  winPatterns: [],
  currentWinPattern: null,
  isGameActive: false,
  isGameComplete: false,
  gameTitle: null,
  gameType: null
});

// Update the hook to accept an optional sessionId parameter
export const useGameData = (sessionId?: string) => useContext(GameDataContext);
