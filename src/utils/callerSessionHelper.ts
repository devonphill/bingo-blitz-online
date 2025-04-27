
import { supabase } from '@/integrations/supabase/client';
import { GameConfig, LegacyGameConfig } from '@/types';

export interface SessionProgressUpdate {
  current_game_number?: number;
  max_game_number?: number;
  current_win_pattern?: string | null;
  current_game_type?: string;
  called_numbers?: number[];
  game_status?: 'pending' | 'active' | 'completed';
}

export async function updateSessionProgress(
  sessionId: string,
  updates: SessionProgressUpdate
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sessions_progress')
      .update(updates)
      .eq('session_id', sessionId);
      
    if (error) {
      console.error('Error updating session progress:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Exception updating session progress:', err);
    return false;
  }
}

// Helper function to convert legacy game configs to new format
export function convertFromLegacyConfig(legacyConfig: LegacyGameConfig): GameConfig {
  // Create a new object in the new format
  const patterns: Record<string, { active: boolean; isNonCash: boolean; prizeAmount: string; description: string }> = {};
  
  if (Array.isArray(legacyConfig.selectedPatterns)) {
    legacyConfig.selectedPatterns.forEach(patternId => {
      const prizeDetails = legacyConfig.prizes?.[patternId] || { amount: '0', isNonCash: false, description: '' };
      
      patterns[patternId] = {
        active: true,
        isNonCash: prizeDetails.isNonCash === true,
        prizeAmount: prizeDetails.amount || '0',
        description: prizeDetails.description || ''
      };
    });
  }
  
  return {
    gameNumber: legacyConfig.gameNumber || 1,
    gameType: legacyConfig.gameType || 'mainstage',
    patterns
  };
}
