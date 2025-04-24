// src/game-rules/gameRulesRegistry.ts

import { NinetyBallRules } from './ninetyBallRules';
// Ensure the class name exported from seventyfiveRules.ts matches here
import { SeventyfiveRules } from './seventyfiveRules';
// Import the *corrected* GameRules interface
import type { GameRules } from './types';

// Registry of game rules implementations
// The type constraint { [key: string]: GameRules } will now use the corrected interface
const GAME_RULES: { [key: string]: GameRules } = {
  '90-ball': new NinetyBallRules(),
  '75-ball': new SeventyfiveRules(), // Assumes seventyfiveRules.ts exports 'SeventyfiveRules'
  // Add more game types as needed
};

/**
 * Get the game rules implementation for a specific game type
 */
export function getGameRulesForType(gameType: string): GameRules {
  // Normalize game type string (remove spaces, lowercase)
  const normalizedType = gameType.toLowerCase().replace(/\s+/g, '-');

  const rules = GAME_RULES[normalizedType];

  if (!rules) {
    console.warn(`Game rules for "${gameType}" not found, using 90-ball as default`);
    // Fallback to 90-ball if type not found
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
