
// Define JSON type for the database
import { GameConfig } from './index';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export function parseJson<T>(json: Json | undefined | null): T | null {
  if (!json) return null;
  
  try {
    if (typeof json === 'string') {
      return JSON.parse(json) as T;
    } else {
      return json as T;
    }
  } catch (err) {
    console.error('Error parsing JSON:', err);
    return null;
  }
}

export function prepareForDatabase(data: any): Json {
  return JSON.parse(JSON.stringify(data));
}

// Helper function to safely convert Json to GameConfig[]
export function parseGameConfigs(json: Json): GameConfig[] {
  if (!json || !Array.isArray(json)) {
    return [];
  }
  
  return json.map((item: any) => ({
    gameNumber: item.gameNumber || 1,
    gameType: item.gameType || 'mainstage',
    patterns: item.patterns || {},
    session_id: item.session_id
  }));
}
