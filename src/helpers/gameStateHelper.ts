
import { GameState, GameType } from '@/types';

// Basic state initialization function for handling database interactions
export const getInitialGameState = (gameType: GameType): GameState => ({
  gameNumber: 1,
  gameType,
  activePatternIds: [],
  calledItems: [],
  lastCalledItem: null,
  status: 'pending',
  prizes: {}
});
