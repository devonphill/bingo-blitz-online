
import React from 'react';
import { Json } from './json';

// Core game types
export type GameType = 'mainstage' | 'party' | 'quiz' | 'music' | 'logo';

// Default pattern ordering and game rules
export const GAME_RULES = {
  mainstage: {
    minPlayers: 2,
    maxPlayers: 100,
    patterns: ['oneLine', 'twoLines', 'fullHouse']
  },
  party: {
    minPlayers: 2,
    maxPlayers: 100,
    patterns: ['corners', 'oneLine', 'twoLines', 'threeLines', 'fullHouse']
  },
  quiz: {
    minPlayers: 2,
    maxPlayers: 50,
    patterns: ['oneLine', 'twoLines', 'fullHouse'],
    questionTime: 30
  },
  music: {
    minPlayers: 2,
    maxPlayers: 50,
    patterns: ['oneLine', 'twoLines', 'fullHouse'],
    songDuration: 30
  },
  logo: {
    minPlayers: 2,
    maxPlayers: 50,
    patterns: ['oneLine', 'twoLines', 'fullHouse'],
    logoDisplayTime: 15
  }
} as const;

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
  game_status?: string;
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

// Add DEFAULT_PATTERN_ORDER to define the standard order of win patterns
export const DEFAULT_PATTERN_ORDER = {
  mainstage: ['oneLine', 'twoLines', 'fullHouse'],
  party: ['corners', 'oneLine', 'twoLines', 'threeLines', 'fullHouse'],
  quiz: ['oneLine', 'twoLines', 'fullHouse'],
  music: ['oneLine', 'twoLines', 'fullHouse'],
  logo: ['oneLine', 'twoLines', 'fullHouse']
} as const;

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
  active_pattern_id?: string | null;
  current_game_state?: CurrentGameState;
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

// Called item type
export interface CalledItem {
  id: string;
  session_id: string;
  game_number: number;
  value: number;
  timestamp: string;
  call_order: number;
}

// Game state type
export interface GameState {
  gameNumber: number;
  gameType: GameType;
  calledItems: CalledItem[];
  lastCalledItem: CalledItem | null;
  status: 'pending' | 'active' | 'completed';
}

// Current game state for player games
export interface CurrentGameState {
  gameNumber?: number;
  gameType?: GameType;
  calledItems?: any[];
  lastCalledItem?: any;
  activePatternIds?: string[];
  prizes?: Record<string, PrizeDetails>;
  status?: 'pending' | 'active' | 'completed';
}

// Export the initial game state helper
export { getInitialGameState } from '@/helpers/gameStateHelper';
