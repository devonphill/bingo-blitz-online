
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

// --- New definition for the state of the currently active game ---
export interface CurrentGameState {
  gameNumber: number;
  gameType: GameType; // The specific type for this individual game instance
  activePatternIds: string[]; // IDs/names of patterns selected by the caller for this game
  calledItems: Array<any>; // Array of called numbers, strings, objects, etc., in order
  lastCalledItem: any | null; // The most recently called item for display
  prizes?: { [patternId: string]: PrizeDetails }; // Updated prize mapping for active patterns
  status: 'pending' | 'active' | 'paused' | 'finished'; // Status of this specific game instance
}
// --- End of new definition ---

// Game configuration interface - updated to include session_id
export interface GameConfig {
  gameNumber: number;
  gameType: GameType;
  selectedPatterns: string[];
  prizes: { [patternId: string]: PrizeDetails };
  session_id?: string; // Added session_id property
}

// Updated GameSession interface
export interface GameSession {
  id: string;
  name: string;
  gameType: GameType; // Overall session game type (can be used as default)
  createdBy: string;
  accessCode: string;
  status: 'pending' | 'active' | 'completed'; // Overall session status
  createdAt: string;
  sessionDate?: string;
  numberOfGames?: number; // Total number of games planned for the session (or current game number?) - clarify usage
  // Add the new column representation
  current_game_state: CurrentGameState | null; // Holds the state of the active game
  // Add the new lifecycle_state property with explicit type definition
  lifecycle_state?: 'setup' | 'live' | 'ended';
  // Add the games_config property
  games_config?: GameConfig[];
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
