
import React from 'react';
import { Json } from './json';

// Core game types
export type GameType = 'mainstage' | 'party' | '75-ball' | '90-ball' | 'quiz' | 'music' | 'logo';

// Session progress type for tracking game state
export interface SessionProgress {
  id: string;
  session_id: string;
  current_game_number: number;
  max_game_number: number;
  current_game_type: string;
  current_win_pattern: string | null;
  created_at: string;
  updated_at: string;
  game_status: string;
}

// Prize details structure
export interface PrizeDetails {
  amount?: string;
  description?: string;
  isNonCash?: boolean;
}

// Game configuration
export interface GameConfig {
  gameNumber: number;
  gameType: GameType;
  patterns: Record<string, WinPatternConfig>;
  session_id?: string;
}

// Win pattern configuration
export interface WinPatternConfig {
  active: boolean;
  isNonCash: boolean;
  prizeAmount: string;
  description: string;
}

// Legacy game configuration format to support older data
export interface LegacyGameConfig {
  gameNumber: number;
  gameType: GameType;
  selectedPatterns: string[];
  prizes: Record<string, {
    amount: string;
    isNonCash: boolean;
    description: string;
  }>;
}

// Game session type
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
  current_game?: number;
  active_pattern_id?: string;
}

// Ticket type
export interface Ticket {
  id: string;
  numbers: number[][];
  layout?: string;
  playerName?: string;
  playerId?: string;
  serial?: string;
}

// Result type
export interface CalledItem {
  value: number;
  timestamp: string;
}

// Game state type
export interface GameState {
  gameNumber: number;
  gameType: GameType;
  calledItems: CalledItem[];
  lastCalledItem: CalledItem | null;
  status: 'pending' | 'active' | 'completed';
}

// Export the initial game state helper
export { getInitialGameState } from '@/helpers/gameStateHelper';
