
import { GameType } from '@/types';

// Basic state initialization function for handling database interactions
export const getInitialGameState = (gameType: GameType) => ({
  gameNumber: 1,
  gameType,
  calledItems: [],
  lastCalledItem: null,
  status: 'pending'
});
