
// src/game-rules/gameRulesRegistry.ts

import { NinetyBallRules } from './ninetyBallRules';
import { SeventyfiveRules } from './seventyfiveRules';
import type { GameRules } from './types';

// Registry of game rules implementations
const GAME_RULES: { [key: string]: GameRules } = {
  '90-ball': new NinetyBallRules(),
  '75-ball': new SeventyfiveRules(),
  // Add game type mappings to existing rules with MAINSTAGE prefix
  'mainstage': new NinetyBallRules(), // Map mainstage to 90-ball rules
  'MAINSTAGE_90-ball': new NinetyBallRules(), // Explicit MAINSTAGE prefix mapping
  'party': new NinetyBallRules(),     // Map party to 90-ball rules
  'music': new SeventyfiveRules(),    // Map music to 75-ball rules
  'quiz': new SeventyfiveRules(),     // Map quiz to 75-ball rules
  'logo': new SeventyfiveRules(),     // Map logo to 75-ball rules
};

/**
 * Get the game rules implementation for a specific game type
 */
export function getGameRulesForType(gameType: string): GameRules {
  // Normalize game type string (remove spaces, lowercase)
  const normalizedType = gameType?.toLowerCase()?.replace(/\s+/g, '-') || '90-ball';
  
  // Try with MAINSTAGE prefix first if it doesn't already have it
  if (!normalizedType.startsWith('mainstage_') && 
      (normalizedType === 'mainstage' || normalizedType === '90-ball')) {
    const mainstageKey = `mainstage_${normalizedType === 'mainstage' ? '90-ball' : normalizedType}`;
    if (GAME_RULES[mainstageKey]) {
      return GAME_RULES[mainstageKey];
    }
  }

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
