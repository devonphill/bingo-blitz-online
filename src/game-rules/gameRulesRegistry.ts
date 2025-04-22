
import { NinetyBallRules } from './ninetyBallRules';
import { SevenfiveRules } from './seventyfiveRules';
import type { GameRules } from './types';

// Registry of game rules implementations
const GAME_RULES: { [key: string]: GameRules } = {
  '90-ball': new NinetyBallRules(),
  '75-ball': new SevenfiveRules(),
  // Add more game types as needed
};

/**
 * Get the game rules implementation for a specific game type
 */
export function getGameRulesForType(gameType: string): GameRules {
  // Normalize game type string (remove spaces, lowercase)
  const normalizedType = gameType.toLowerCase().replace(/\s+/g, '-');
  
  // Default to 90-ball if the game type is not recognized
  const rules = GAME_RULES[normalizedType] || GAME_RULES['90-ball'];
  
  if (!rules) {
    console.warn(`Game rules for "${gameType}" not found, using 90-ball as fallback`);
    return GAME_RULES['90-ball'];
  }
  
  return rules;
}

/**
 * Register a new game rules implementation
 */
export function registerGameRules(gameType: string, implementation: GameRules): void {
  const normalizedType = gameType.toLowerCase().replace(/\s+/g, '-');
  GAME_RULES[normalizedType] = implementation;
}
