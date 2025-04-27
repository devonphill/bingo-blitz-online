
import { GameState, GameType } from '@/types';

// Basic state initialization function for handling database interactions
export const getInitialGameState = (gameType: GameType): GameState => ({
  gameNumber: 1,
  gameType,
  calledItems: [],
  lastCalledItem: null,
  status: 'pending'
});
