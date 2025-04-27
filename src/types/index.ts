
import { WinPattern, GameType as WinPatternGameType } from './winPattern';
import { GameRules } from '@/game-rules/types';

// Use the same GameType from winPattern.ts
export type GameType = WinPatternGameType;

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
  game_status?: 'pending' | 'active' | 'completed';
}

// Types for player admin
export interface AdminTempPlayer {
  nickname: string;
  email?: string;
  ticketCount: number;
  playerCode?: string;
  tickets?: number;
}

// Helper functions for getting default patterns
export function getDefaultPatternsForType(gameType: GameType): string[] {
  switch (gameType) {
    case 'party':
      return ['corners', 'oneLine', 'twoLines', 'threeLines', 'fullHouse'];
    case 'quiz':
    case 'music':
    case 'logo':
    case 'mainstage':
    case '90-ball':
      return ['oneLine', 'twoLines', 'fullHouse'];
    case '75-ball':
      return ['oneLine', 'coverAll'];
    case 'speed':
      return ['oneLine', 'fullHouse'];
    default:
      return ['oneLine', 'twoLines', 'fullHouse'];
  }
}

// Export for backward compatibility
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
