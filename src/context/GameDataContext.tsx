
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
});

export const useGameData = () => useContext(GameDataContext);
