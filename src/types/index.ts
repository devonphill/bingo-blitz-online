
import { WinPattern } from './winPattern';
import { GameRules } from '@/game-rules/types';

// Add other common types here
export type GameType = 'mainstage' | '90-ball' | '75-ball' | 'speed' | 'custom';

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
}

// Types for player admin
export interface AdminTempPlayer {
  nickname: string;
  email?: string;
  ticketCount: number;
}
