
import { z } from "zod";

// Common win pattern type
export interface DefaultWinPattern {
  id: string;
  name: string;
  description: string;
  validate: (markedCells: number[], board: number[][]) => boolean;
}

// Base game rules interface
export interface GameRules {
  getDefaultWinPatterns(): DefaultWinPattern[];
  validatePattern(
    patternId: string, 
    markedCells: number[], 
    board: number[][]
  ): boolean;
}

// Zod schema for validating game rule configuration
export const GameRuleConfigSchema = z.object({
  gameType: z.string(),
});

export type GameRuleConfig = z.infer<typeof GameRuleConfigSchema>;
