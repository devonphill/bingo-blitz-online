
// Define a recursive JSON type for better type handling with Supabase
export type Json = 
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

// Type guard to check if an object is of a specific interface type
export function isOfType<T>(obj: any, props: Array<keyof T>): obj is T {
  return props.every(prop => prop in obj);
}

// Helper function for safely type-asserting JSON objects from API responses
export function typedJsonValue<T>(json: any): T {
  return json as T;
}

// Manual type definitions for new database tables
export interface GameConfigurationType {
  id: string;
  session_id: string;
  game_number: number;
  game_type: string;
  created_at: string;
  updated_at: string;
}

export interface GamePatternType {
  id: string;
  game_config_id: string;
  pattern_id: string;
  pattern_order: number;
  prize_amount?: string;
  prize_description?: string;
  is_non_cash: boolean;
  created_at: string;
}

export interface CalledItemType {
  id: string;
  session_id: string;
  game_number: number;
  item_value: number;
  called_at: string;
  call_order: number;
}

// Add a type for the active_pattern_id that's used but not in the database schema
export interface SessionWithActivePattern {
  id: string;
  active_pattern_id?: string | null;
  current_game?: number;
}

// WinPattern config structure to match our new JSON format
export interface WinPatternConfig {
  active: boolean;
  isNonCash: boolean;
  prizeAmount: string;
  description: string;
}

// Updated game config structure that matches our new JSON format
export interface GameConfigItem {
  gameNumber: number;
  gameType: string;
  patterns: {
    [patternId: string]: WinPatternConfig;
  };
}

// Helper function to check if an object has the structure of a GameConfigItem
export function isGameConfigItem(obj: any): obj is GameConfigItem {
  return obj && 
    typeof obj === 'object' &&
    'gameNumber' in obj &&
    'gameType' in obj &&
    'patterns' in obj &&
    typeof obj.patterns === 'object';
}

// Helper function to check if a pattern has the structure of WinPatternConfig
export function isWinPatternConfig(obj: any): obj is WinPatternConfig {
  return obj && 
    typeof obj === 'object' &&
    'active' in obj &&
    'isNonCash' in obj &&
    'prizeAmount' in obj &&
    'description' in obj;
}

// Helper function to safely access patterns data
export function getPatternConfig(patterns: unknown, patternId: string): WinPatternConfig | null {
  if (!patterns || typeof patterns !== 'object') return null;
  
  const patternsObj = patterns as Record<string, unknown>;
  const patternConfig = patternsObj[patternId];
  
  if (!patternConfig || typeof patternConfig !== 'object') return null;
  
  const config = patternConfig as Record<string, unknown>;
  
  if (
    'active' in config && 
    'isNonCash' in config && 
    'prizeAmount' in config && 
    'description' in config
  ) {
    return {
      active: Boolean(config.active),
      isNonCash: Boolean(config.isNonCash),
      prizeAmount: String(config.prizeAmount || ''),
      description: String(config.description || '')
    };
  }
  
  return null;
}

// Convert JSON to typed GameConfigItem
export function parseGameConfigItem(json: Json): GameConfigItem | null {
  if (typeof json !== 'object' || json === null) return null;
  
  const obj = json as Record<string, unknown>;
  
  if (!('gameNumber' in obj) || !('gameType' in obj) || !('patterns' in obj)) return null;
  if (typeof obj.patterns !== 'object' || obj.patterns === null) return null;
  
  const gameNumber = Number(obj.gameNumber);
  const gameType = String(obj.gameType);
  const patternsObj = obj.patterns as Record<string, unknown>;
  
  const patterns: Record<string, WinPatternConfig> = {};
  
  Object.entries(patternsObj).forEach(([patternId, value]) => {
    if (typeof value !== 'object' || value === null) return;
    
    const configObj = value as Record<string, unknown>;
    
    if (
      'active' in configObj && 
      'isNonCash' in configObj && 
      'prizeAmount' in configObj && 
      'description' in configObj
    ) {
      patterns[patternId] = {
        active: Boolean(configObj.active),
        isNonCash: Boolean(configObj.isNonCash),
        prizeAmount: String(configObj.prizeAmount || ''),
        description: String(configObj.description || '')
      };
    }
  });
  
  return {
    gameNumber,
    gameType,
    patterns
  };
}

// Helper function to safely convert JSON data to GameConfigItem array
export function parseGameConfigs(json: Json | null | undefined): GameConfigItem[] {
  if (!json) return [];
  if (!Array.isArray(json)) return [];
  
  return json
    .map(item => parseGameConfigItem(item))
    .filter((item): item is GameConfigItem => item !== null);
}
