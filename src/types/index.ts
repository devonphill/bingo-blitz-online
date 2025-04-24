
// This file defines the core data structures used throughout the application.

export type UserRole = 'superuser' | 'subuser';

export interface User {
  id: string;
  username: string;
  role: UserRole;
}

// Updated GameType definition to include '75-ball'
export type GameType = '90-ball' | '75-ball' | '80-ball' | 'quiz' | 'music' | 'logo' | 'mixed';

// --- New definition for the state of the currently active game ---
export interface CurrentGameState {
  gameNumber: number;
  gameType: GameType; // The specific type for this individual game instance
  activePatternIds: string[]; // IDs/names of patterns selected by the caller for this game
  calledItems: Array<any>; // Array of called numbers, strings, objects, etc., in order
  lastCalledItem: any | null; // The most recently called item for display
  prizes?: { [patternId: string]: string }; // Optional prize mapping for active patterns
  status: 'pending' | 'active' | 'paused' | 'finished'; // Status of this specific game instance
}
// --- End of new definition ---

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
