
// Any additional types needed for the app that aren't covered by the other interfaces
import { Json } from './json';

export type GameType = 'mainstage' | '75ball' | '90ball' | 'quickfire';

export const DEFAULT_PATTERN_ORDER: Record<GameType, string[]> = {
  'mainstage': ['oneLine', 'twoLines', 'fullHouse'],
  '75ball': ['pattern1', 'pattern2', 'pattern3'],
  '90ball': ['oneLine', 'twoLines', 'fullHouse'],
  'quickfire': ['oneNumber', 'twoNumbers', 'threeNumbers']
};

export interface WinPatternConfig {
  active: boolean;
  isNonCash: boolean;
  prizeAmount: string;
  description: string;
}

export interface GameConfig {
  gameNumber: number;
  gameType: GameType;
  patterns: Record<string, WinPatternConfig>;
  session_id?: string;
}

export interface LegacyGameConfig {
  gameNumber: number;
  gameType: GameType;
  selectedPatterns: string[];
  prizes: {
    [patternId: string]: {
      amount: string;
      isNonCash: boolean;
      description: string;
    };
  };
}

export function isLegacyGameConfig(config: any): boolean {
  return config && 
    typeof config === 'object' && 
    'selectedPatterns' in config && 
    'prizes' in config;
}

export function convertLegacyGameConfig(config: LegacyGameConfig): GameConfig {
  const patterns: Record<string, WinPatternConfig> = {};
  
  config.selectedPatterns.forEach(patternId => {
    const prize = config.prizes[patternId] || {};
    patterns[patternId] = {
      active: true,
      isNonCash: prize.isNonCash || false,
      prizeAmount: prize.amount || '0.00',
      description: prize.description || ''
    };
  });
  
  return {
    gameNumber: config.gameNumber,
    gameType: config.gameType,
    patterns
  };
}

export interface PrizeDetails {
  amount: string;
  isNonCash: boolean;
  description: string;
}

export interface Ticket {
  id: string;
  playerId: string;
  sessionId: string;
  serial: string; 
  perm: number;
  position: number;
  layoutMask: number;
  numbers: number[];
  timeStamp?: string;
}

export interface SessionProgress {
  id: string;
  session_id: string;
  current_game_number: number;
  max_game_number: number;
  current_win_pattern: string | null;
  current_game_type: GameType;
  created_at: string;
  updated_at: string;
  called_numbers: number[];
  game_status: 'pending' | 'active' | 'completed';
}

export interface Player {
  id: string;
  nickname: string;
  sessionId: string;
  tickets: number;
  playerCode: string;
  joinedAt: string;
  email?: string;
}

export interface TempPlayer {
  nickname: string;
  email: string;
  tickets: number;
  playerCode: string;
}

export interface AdminTempPlayer {
  nickname: string;
  email: string;
  ticketCount: number;
  playerCode: string;
  tickets: number;
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
}
