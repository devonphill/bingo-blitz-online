
import { WinPattern } from './winPattern';
import { GameRules } from '@/game-rules/types';

// Add other common types here
export type GameType = 'mainstage' | '90-ball' | '75-ball' | 'speed' | 'custom' | 'party' | 'quiz' | 'music' | 'logo';

export interface PrizeDetails {
  amount: string;
  isNonCash: boolean;
  description: string;
}

export interface WinPatternConfig {
  active: boolean;
  isNonCash: boolean;
  prizeAmount: string;
  description: string;
}

// GameConfig interface supporting both legacy and new formats
export interface GameConfig {
  gameNumber: number;
  gameType: GameType;
  patterns: Record<string, WinPatternConfig>;
  session_id?: string;
  
  // Support for legacy properties, marked as optional
  selectedPatterns?: string[];
  prizes?: { [patternId: string]: PrizeDetails };
}

export interface LegacyGameConfig {
  gameNumber: number;
  gameType: GameType;
  selectedPatterns: string[];
  prizes: { [patternId: string]: PrizeDetails };
}

export function isLegacyGameConfig(config: any): config is LegacyGameConfig {
  return config && Array.isArray(config.selectedPatterns) && typeof config.prizes === 'object';
}

export function convertLegacyGameConfig(config: LegacyGameConfig): GameConfig {
  const patterns: Record<string, WinPatternConfig> = {};
  if (config.selectedPatterns && Array.isArray(config.selectedPatterns)) {
    config.selectedPatterns.forEach(patternId => {
      const prize = config.prizes[patternId] || {};
      patterns[patternId] = {
        active: true,
        isNonCash: prize.isNonCash || false,
        prizeAmount: prize.amount || '10.00',
        description: prize.description || `${patternId} Prize`
      };
    });
  }
  
  return {
    gameNumber: config.gameNumber,
    gameType: config.gameType,
    patterns
  };
}

export interface GameState {
  gameNumber: number;
  gameType: GameType;
  activePatternIds: string[];
  calledItems: number[];
  lastCalledItem: number | null;
  status: 'pending' | 'active' | 'completed';
  prizes: { [patternId: string]: PrizeDetails };
}

export interface CurrentGameState {
  gameNumber: number;
  gameType: GameType;
  activePatternIds: string[];
  calledItems: number[];
  lastCalledItem: number | null;
  status: 'pending' | 'active' | 'completed';
  prizes: { [patternId: string]: PrizeDetails };
}

export interface GameSession {
  id: string;
  name: string;
  gameType: GameType;
  createdBy: string;
  accessCode: string;
  status: 'pending' | 'active' | 'completed';
  createdAt: string;
  sessionDate?: string;
  numberOfGames: number;
  current_game: number;
  lifecycle_state: 'setup' | 'live' | 'ended' | 'completed';
  games_config: GameConfig[];
  current_game_state?: CurrentGameState;
}

export interface Player {
  id: string;
  nickname: string;
  sessionId: string;
  joinedAt: string;
  tickets: number;
  playerCode: string;
  email?: string;
}

export interface Ticket {
  id: string;
  playerId: string;
  sessionId: string;
  numbers: number[];
  serial: string;
  position: number;
  layoutMask: number;
  perm?: number;
}

export interface SessionProgress {
  id: string;
  session_id: string;
  current_game_number: number;
  max_game_number: number;
  current_win_pattern?: string;
  current_game_type: GameType;
  created_at: string;
  updated_at: string;
  called_numbers?: number[];
}

// Types for player admin
export interface AdminTempPlayer {
  nickname: string;
  email?: string;
  ticketCount: number;
}

// Add GAME_RULES constant
export const GAME_RULES: Record<string, any> = {
  mainstage: {
    minPlayers: 1,
    maxPlayers: 500,
    patterns: ['oneLine', 'twoLines', 'fullHouse']
  },
  'party': {
    minPlayers: 5,
    maxPlayers: 100,
    patterns: ['corners', 'oneLine', 'twoLines', 'threeLines', 'fullHouse']
  },
  'quiz': {
    minPlayers: 2,
    maxPlayers: 50,
    patterns: ['oneLine', 'twoLines', 'fullHouse'],
    questionTime: 30
  },
  'music': {
    minPlayers: 5,
    maxPlayers: 100,
    patterns: ['oneLine', 'twoLines', 'fullHouse'],
    songDuration: 15
  },
  'logo': {
    minPlayers: 5,
    maxPlayers: 100,
    patterns: ['oneLine', 'twoLines', 'fullHouse'],
    logoDisplayTime: 10
  },
  '90-ball': {
    minPlayers: 1,
    maxPlayers: 500,
    patterns: ['oneLine', 'twoLines', 'fullHouse']
  },
  '75-ball': {
    minPlayers: 1,
    maxPlayers: 500,
    patterns: ['oneLine', 'coverAll']
  },
  'speed': {
    minPlayers: 1,
    maxPlayers: 200,
    patterns: ['oneLine', 'fullHouse']
  },
  'custom': {
    minPlayers: 1,
    maxPlayers: 500,
    patterns: ['oneLine', 'twoLines', 'fullHouse']
  }
};

// Add DEFAULT_PATTERN_ORDER constant
export const DEFAULT_PATTERN_ORDER: Record<GameType, string[]> = {
  'mainstage': ['oneLine', 'twoLines', 'fullHouse'],
  'party': ['corners', 'oneLine', 'twoLines', 'threeLines', 'fullHouse'],
  'quiz': ['oneLine', 'twoLines', 'fullHouse'],
  'music': ['oneLine', 'twoLines', 'fullHouse'],
  'logo': ['oneLine', 'twoLines', 'fullHouse'],
  '90-ball': ['oneLine', 'twoLines', 'fullHouse'],
  '75-ball': ['oneLine', 'coverAll'],
  'speed': ['oneLine', 'fullHouse'],
  'custom': ['oneLine', 'twoLines', 'fullHouse']
};
