// This file defines the core data structures used throughout the application.

export type UserRole = 'superuser' | 'subuser';

export interface User {
  id: string;
  username: string;
  role: UserRole;
}

// Updated GameType definition to include 'mainstage', 'party', 'quiz', 'music', and 'logo'
export type GameType = 'mainstage' | 'party' | 'quiz' | 'music' | 'logo';

// Prize details interface - updated to include isNonCash property
export interface PrizeDetails {
  amount?: string;
  description?: string;
  isNonCash?: boolean;
}

// --- New definition for game configuration and patterns ---
export interface GamePattern {
  id: string;
  game_config_id: string;
  pattern_id: string;
  pattern_order: number;
  prize_amount?: string;
  prize_description?: string;
  is_non_cash: boolean;
  created_at: string;
}

export interface GameConfiguration {
  id: string;
  session_id: string;
  game_number: number;
  game_type: GameType;
  created_at: string;
  updated_at: string;
  patterns?: GamePattern[];
}

// --- New definition for called items ---
export interface CalledItem {
  id: string;
  session_id: string;
  game_number: number;
  item_value: number;
  called_at: string;
  call_order: number;
}

// Updated game configuration interface with new pattern structure
export interface GameConfig {
  gameNumber: number;
  gameType: GameType;
  patterns: {
    [patternId: string]: {
      active: boolean;
      isNonCash: boolean;
      prizeAmount: string;
      description: string;
    }
  };
  session_id?: string;
}

// Game session interface without current_game_state
export interface GameSession {
  id: string;
  name: string;
  gameType: GameType;
  createdBy: string;
  accessCode: string;
  status: 'pending' | 'active' | 'completed';
  createdAt: string;
  sessionDate?: string;
  numberOfGames?: number;
  lifecycle_state?: 'setup' | 'live' | 'ended';
  games_config?: GameConfig[];
  active_pattern_id?: string;
  current_game?: number;
}

// Existing Player interface - no changes needed for Phase 1
export interface Player {
  id: string;
  sessionId: string;
  nickname: string;
  joinedAt: string;
  playerCode: string;
  email?: string;
  tickets: number; // Number of strips/books assigned
}

// Existing BingoCell/Card types - likely needed for specific game displays later
export interface BingoCell {
  number: number | null;
  marked: boolean;
}

export interface BingoCard {
  id: string;
  playerId: string;
  cells: BingoCell[][]; // This structure might become game-specific later
}

// Existing BingoCaller type - might be replaced or refactored by the new state management
export interface BingoCaller {
  sessionId: string;
  calledNumbers: number[];
  currentNumber: number | null;
}

export interface SessionProgress {
  id: string;
  session_id: string;
  current_game_number: number;
  max_game_number: number;
  current_game_type: string;
  current_win_pattern: string | null;
  created_at: string;
  updated_at: string;
}

// New interface for pattern order definition
export interface PatternOrder {
  [gameType: string]: string[];  // Maps game type to ordered array of pattern IDs
}

// Default pattern progression order for each game type
export const DEFAULT_PATTERN_ORDER: PatternOrder = {
  'mainstage': ['oneLine', 'twoLines', 'fullHouse'],
  'party': ['corners', 'oneLine', 'twoLines', 'threeLines', 'fullHouse'],
  'quiz': ['oneLine', 'twoLines', 'fullHouse'],
  'music': ['oneLine', 'twoLines', 'fullHouse'],
  'logo': ['oneLine', 'twoLines', 'fullHouse']
};
