
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameConfig, WinPatternConfig, GameType } from '@/types';
import { normalizeGameConfig } from '@/utils/gameConfigHelper';
import { getDefaultPatternsForType } from '@/types';
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
      console.log(`Fetching game configs for session: ${sessionId}`);
      const { data, error } = await supabase
        .from('game_sessions')
        .select('games_config, current_game, game_type, number_of_games')
        .eq('id', sessionId)
        .single();

      if (error) {
        throw error;
      }

      console.log("Fetched session data:", data);
      let configs: GameConfig[] = [];
      const numberOfGames = data.number_of_games || 1;

      // Check if games_config exists and is a valid array
      if (data.games_config && Array.isArray(data.games_config) && data.games_config.length > 0) {
        console.log("Using existing games_config from database:", data.games_config);
        configs = (data.games_config as any[]).map(config => normalizeGameConfig(config));
      } else {
        console.log("No valid games_config found, creating defaults");
        // Create default configs for all games
        configs = Array.from({ length: numberOfGames }, (_, i) => 
          createDefaultGameConfig(i + 1, (data.game_type || 'mainstage') as GameType)
        );
        
        // Save these default configs to the database
        const { error: saveError } = await supabase
          .from('game_sessions')
          .update({ games_config: configs as unknown as Json })
          .eq('id', sessionId);
          
        if (saveError) {
          console.error("Error saving default game configs:", saveError);
        } else {
          console.log("Saved default game configs to database");
        }
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
      console.log("Saving game configs:", configs);
      // Convert GameConfig[] to a JSON-compatible format
      const jsonConfigs = configs.map(config => ({
        ...config,
        patterns: { ...config.patterns }
      }));
      
      const { error } = await supabase
        .from('game_sessions')
        .update({ games_config: jsonConfigs as unknown as Json })
        .eq('id', sessionId);

      if (error) {
        console.error("Error from Supabase:", error);
        throw error;
      }
      
      console.log("Game configs saved successfully");
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
    console.log(`Creating default game config for game ${gameNumber}, type ${gameType}`);
    const patterns: Record<string, WinPatternConfig> = {};
    
    const defaultPatterns = getDefaultPatternsForType(gameType);
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
