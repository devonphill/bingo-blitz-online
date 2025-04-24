
import { GameType, CurrentGameState } from '@/types';

export const getCurrentGameState = (gameType: GameType): CurrentGameState => ({
  gameNumber: 1,
  gameType,
  activePatternIds: [],
  calledItems: [],
  lastCalledItem: null,
  status: 'pending',
  prizes: {},
});
