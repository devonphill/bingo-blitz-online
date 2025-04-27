
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

// Updated game config structure that matches our new JSON format
export interface WinPatternConfig {
  active: boolean;
  isNonCash: boolean;
  prizeAmount: string;
  description: string;
}

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
