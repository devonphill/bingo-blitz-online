
// Any additional types needed for the app that aren't covered by the other interfaces
import { Json } from './json';

export type GameType = 'mainstage' | '75ball' | '90ball' | 'quickfire' | 'party' | 'quiz' | 'music' | 'logo' | 'speed';

export const DEFAULT_PATTERN_ORDER: Record<GameType, string[]> = {
  'mainstage': ['oneLine', 'twoLines', 'fullHouse'],
  '75ball': ['pattern1', 'pattern2', 'pattern3'],
  '90ball': ['oneLine', 'twoLines', 'fullHouse'],
  'quickfire': ['oneNumber', 'twoNumbers', 'threeNumbers'],
  'party': ['oneLine', 'twoLines', 'fullHouse'],
  'quiz': ['oneLine', 'twoLines', 'fullHouse'],
  'music': ['oneLine', 'twoLines', 'fullHouse'],
  'logo': ['oneLine', 'twoLines', 'fullHouse'],
  'speed': ['oneLine', 'fullHouse']
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
  // For backward compatibility
  selectedPatterns?: string[];
  prizes?: Record<string, PrizeDetails>;
}

export interface GameState {
  gameNumber: number;
  gameType: GameType;
  activePatternIds: string[];
  calledItems: any[];
  lastCalledItem: any | null;
  status: 'pending' | 'active' | 'completed';
  prizes: Record<string, any>;
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

export function getDefaultPatternsForType(gameType: GameType): string[] {
  return DEFAULT_PATTERN_ORDER[gameType] || ['oneLine', 'twoLines', 'fullHouse'];
}

export function isLegacyGameConfig(config: any): boolean {
  return config && 
    typeof config === 'object' && 
    'selectedPatterns' in config && 
    'prizes' in config;
}

export function convertLegacyGameConfig(config: LegacyGameConfig): GameConfig {
  const patterns: Record<string, WinPatternConfig> = {};
  
  if (Array.isArray(config.selectedPatterns)) {
    config.selectedPatterns.forEach(patternId => {
      // Make sure prizes exist and have proper defaults
      const prizes = config.prizes || {};
      const prize = prizes[patternId] || {};
      
      patterns[patternId] = {
        active: true,
        isNonCash: prize?.isNonCash ?? false,
        prizeAmount: prize?.amount ?? '0.00',
        description: prize?.description ?? ''
      };
    });
  }
  
  return {
    gameNumber: config.gameNumber || 1,
    gameType: config.gameType || 'mainstage',
    patterns
  };
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

export function parseGameConfigs(json: Json): GameConfig[] {
  if (!json || !Array.isArray(json)) {
    return [];
  }
  
  return json.map((item: any) => ({
    gameNumber: item.gameNumber || 1,
    gameType: item.gameType || 'mainstage',
    patterns: item.patterns || {},
    session_id: item.session_id
  })) as GameConfig[];
}
