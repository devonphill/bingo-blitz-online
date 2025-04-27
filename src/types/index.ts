
import React from 'react';
import { Json } from './json';

// Core game types
export type GameType = 'mainstage' | 'party' | '75-ball' | '90-ball' | 'quiz' | 'music' | 'logo';

// Default pattern ordering for UI display
export const DEFAULT_PATTERN_ORDER = {
  mainstage: ['oneLine', 'twoLines', 'fullHouse'],
  party: ['corners', 'oneLine', 'twoLines', 'threeLines', 'fullHouse'],
  quiz: ['oneLine', 'twoLines', 'fullHouse'],
  music: ['oneLine', 'twoLines', 'fullHouse'],
  logo: ['oneLine', 'twoLines', 'fullHouse']
};

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

// Helper functions for game config conversion
export function isLegacyGameConfig(config: any): config is LegacyGameConfig {
  return config && 
    typeof config === 'object' && 
    'gameNumber' in config && 
    'gameType' in config && 
    'selectedPatterns' in config &&
    'prizes' in config;
}

export function convertLegacyGameConfig(legacy: LegacyGameConfig): GameConfig {
  const patterns: Record<string, WinPatternConfig> = {};
  
  // Convert each pattern in the legacy config
  legacy.selectedPatterns.forEach(patternId => {
    const prize = legacy.prizes[patternId];
    patterns[patternId] = {
      active: true,
      isNonCash: prize?.isNonCash || false,
      prizeAmount: prize?.amount || '0.00',
      description: prize?.description || ''
    };
  });
  
  return {
    gameNumber: legacy.gameNumber,
    gameType: legacy.gameType,
    patterns
  };
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

// Player type
export interface Player {
  id: string;
  nickname: string;
  player_code: string;
  session_id: string;
  joined_at: string;
  tickets: number;
  email?: string;
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
