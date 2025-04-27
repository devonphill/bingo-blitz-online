
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameConfig, DEFAULT_PATTERN_ORDER, WinPatternConfig, GameType } from '@/types';
import { normalizeGameConfig } from '@/utils/gameConfigHelper';
import { Json } from '@/types/json';

export function useGameData(sessionId: string | undefined) {
  const [gameConfigs, setGameConfigs] = useState<GameConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGameConfigs = useCallback(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('game_sessions')
        .select('games_config, current_game, game_type')
        .eq('id', sessionId)
        .single();

      if (error) {
        throw error;
      }

      let configs: GameConfig[] = [];

      if (data.games_config && Array.isArray(data.games_config)) {
        configs = data.games_config.map(config => normalizeGameConfig(config));
      } else {
        // If no configs exist yet, create a default one based on game_type
        const gameType = (data.game_type || 'mainstage') as GameType;
        configs = [createDefaultGameConfig(1, gameType)];
      }

      setGameConfigs(configs);
    } catch (err) {
      console.error('Error fetching game configs:', err);
      setError('Failed to fetch game configurations');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const saveGameConfigs = useCallback(async (configs: GameConfig[]): Promise<boolean> => {
    if (!sessionId || !configs.length) return false;

    try {
      // Convert GameConfig[] to a JSON-compatible format
      const jsonConfigs: Json = JSON.parse(JSON.stringify(configs));
      
      const { error } = await supabase
        .from('game_sessions')
        .update({ games_config: jsonConfigs })
        .eq('id', sessionId);

      if (error) throw error;
      
      setGameConfigs(configs);
      return true;
    } catch (err) {
      console.error('Error saving game configs:', err);
      setError('Failed to save game configurations');
      return false;
    }
  }, [sessionId]);

  const updateGameConfig = useCallback(async (
    gameNumber: number, 
    updates: Partial<GameConfig>
  ): Promise<boolean> => {
    const configIndex = gameConfigs.findIndex(c => c.gameNumber === gameNumber);
    
    if (configIndex < 0) return false;
    
    const newConfigs = [...gameConfigs];
    newConfigs[configIndex] = { ...newConfigs[configIndex], ...updates };
    
    return await saveGameConfigs(newConfigs);
  }, [gameConfigs, saveGameConfigs]);

  const updateWinPattern = useCallback(async (
    gameNumber: number,
    patternId: string,
    updates: Partial<WinPatternConfig>
  ): Promise<boolean> => {
    const configIndex = gameConfigs.findIndex(c => c.gameNumber === gameNumber);
    
    if (configIndex < 0) return false;
    
    const currentConfig = gameConfigs[configIndex];
    
    // Ensure patterns object exists
    const patterns = currentConfig.patterns || {};
    
    // Ensure the pattern exists
    let patternConfig = patterns[patternId];
    if (!patternConfig) {
      // Create a default pattern config if it doesn't exist
      patternConfig = {
        active: false,
        isNonCash: false,
        prizeAmount: '10.00',
        description: `${patternId} Prize`
      };
    }
    
    // Apply updates
    const updatedPattern = { ...patternConfig, ...updates };
    
    // Create new config with updated pattern
    const updatedPatterns = { ...patterns, [patternId]: updatedPattern };
    const updatedConfig = { ...currentConfig, patterns: updatedPatterns };
    
    // Update the gameConfigs array
    const newConfigs = [...gameConfigs];
    newConfigs[configIndex] = updatedConfig;
    
    return await saveGameConfigs(newConfigs);
  }, [gameConfigs, saveGameConfigs]);

  const getActivePatterns = useCallback((gameNumber: number): string[] => {
    const config = gameConfigs.find(c => c.gameNumber === gameNumber);
    if (!config) return [];
    
    return Object.entries(config.patterns || {})
      .filter(([_, pattern]) => pattern.active)
      .map(([id]) => id);
  }, [gameConfigs]);

  const getCurrentGamePatterns = useCallback((currentGame: number): Record<string, WinPatternConfig> => {
    const config = gameConfigs.find(c => c.gameNumber === currentGame);
    return config?.patterns || {};
  }, [gameConfigs]);

  // Helper function to create a default game configuration
  function createDefaultGameConfig(gameNumber: number, gameType: GameType = 'mainstage'): GameConfig {
    const patterns: Record<string, WinPatternConfig> = {};
    
    const defaultPatterns = DEFAULT_PATTERN_ORDER[gameType] || ['oneLine', 'twoLines', 'fullHouse'];
    defaultPatterns.forEach(patternId => {
      patterns[patternId] = {
        active: patternId === 'oneLine', // Only activate first pattern by default
        isNonCash: false,
        prizeAmount: '10.00',
        description: `${patternId} Prize`
      };
    });
    
    return {
      gameNumber,
      gameType,
      patterns
    };
  }

  useEffect(() => {
    fetchGameConfigs();
  }, [fetchGameConfigs]);

  return {
    gameConfigs,
    fetchGameConfigs,
    saveGameConfigs,
    updateGameConfig,
    updateWinPattern,
    getActivePatterns,
    getCurrentGamePatterns,
    isLoading,
    error
  };
}
