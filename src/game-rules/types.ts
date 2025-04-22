
import type { WinPatternConfig } from '@/hooks/useWinPatternManagement';

/**
 * Interface that all game rule implementations must implement
 */
export interface GameRules {
  /**
   * Get the default win patterns for this game type
   */
  getDefaultWinPatterns(): WinPatternConfig[];
  
  /**
   * Validate if a ticket has a valid win for the given pattern
   */
  validateWin(patternId: string, ticket: any, calledNumbers: number[]): boolean;
  
  /**
   * Get the name of the game type
   */
  getGameTypeName(): string;
  
  /**
   * Get the distance to winning for a ticket (used for "X to go" calculation)
   */
  getWinDistance(patternId: string, ticket: any, calledNumbers: number[]): number;
}
