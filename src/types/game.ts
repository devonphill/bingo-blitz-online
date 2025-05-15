
// Basic game status types
export type GameStatus = 'setup' | 'pending' | 'active' | 'complete' | 'cancelled' | null;

// Basic game configuration
export interface GameConfig {
  id?: number;
  gameNumber: number;
  gameType: string;
  winPatterns: any[];
  prizes: any[];
  isActive?: boolean;
  status?: GameStatus;
}
