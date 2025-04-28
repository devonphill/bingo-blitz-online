import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameConfig, WinPatternConfig, GameType } from '@/types';
import { getDefaultPatternsForType } from '@/types';
import { gameConfigsToJson, jsonToGameConfigs } from '@/utils/jsonUtils';
import { useToast } from '@/hooks/use-toast';

export function useGameData(sessionId: string | undefined) {
  const [gameConfigs, setGameConfigs] = useState<GameConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

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

      if (error) throw error;

      console.log("Raw session data from database:", data);
      let configs: GameConfig[] = [];
      const numberOfGames = data.number_of_games || 1;
      const gameType = data.game_type || 'mainstage';
      
      if (data.games_config) {
        console.log("Raw games_config from database:", data.games_config);
        configs = jsonToGameConfigs(data.games_config);
        console.log("Parsed game configs:", configs);
      } 
      
      if (configs.length < numberOfGames) {
        console.log(`Creating default configs for missing games (${numberOfGames} required, ${configs.length} found)`);
        
        const newConfigs = Array.from({ length: numberOfGames }, (_, i) => {
          const gameNumber = i + 1;
          
          if (i < configs.length && configs[i]) {
            return configs[i];
          }
          
          return createDefaultGameConfig(gameNumber, gameType as GameType, sessionId, false);
        });
        
        configs = newConfigs;
      }

      setGameConfigs(configs);
      setIsInitialized(true);
    } catch (err) {
      console.error('Error fetching game configs:', err);
      setError(`Failed to fetch game configurations: ${(err as Error).message}`);
      toast({
        title: "Error",
        description: "Failed to load game configurations",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, toast]);

  const saveGameConfigs = useCallback(async (configs: GameConfig[]): Promise<boolean> => {
    if (!sessionId || !configs.length) {
      console.error("Cannot save game configs: missing session ID or configs");
      return false;
    }

    try {
      console.log("Saving game configs:", configs);
      
      const configsWithSessionId = configs.map(config => ({
        ...config,
        session_id: sessionId
      }));
      
      const jsonConfigs = gameConfigsToJson(configsWithSessionId);
      console.log("JSON configs to save to database:", jsonConfigs);
      
      const { error } = await supabase
        .from('game_sessions')
        .update({ games_config: jsonConfigs })
        .eq('id', sessionId);

      if (error) {
        console.error("Error saving game configs to Supabase:", error);
        toast({
          title: "Error",
          description: "Failed to save game configurations",
          variant: "destructive"
        });
        return false;
      }
      
      console.log("Game configs saved successfully");
      setGameConfigs(configsWithSessionId);
      return true;
    } catch (err) {
      console.error('Error saving game configs:', err);
      setError(`Failed to save game configurations: ${(err as Error).message}`);
      toast({
        title: "Error",
        description: "An unexpected error occurred while saving",
        variant: "destructive"
      });
      return false;
    }
  }, [sessionId, toast]);

  const updateGameConfig = useCallback(async (
    gameNumber: number, 
    updates: Partial<GameConfig>
  ): Promise<boolean> => {
    console.log(`Updating game ${gameNumber} with:`, updates);
    const configIndex = gameConfigs.findIndex(c => c.gameNumber === gameNumber);
    
    if (configIndex < 0) {
      console.error(`Game number ${gameNumber} not found in configs`);
      return false;
    }
    
    const newConfigs = [...gameConfigs];
    newConfigs[configIndex] = { ...newConfigs[configIndex], ...updates };
    
    return await saveGameConfigs(newConfigs);
  }, [gameConfigs, saveGameConfigs]);

  const updateWinPattern = useCallback(async (
    gameNumber: number,
    patternId: string,
    updates: Partial<WinPatternConfig>
  ): Promise<boolean> => {
    console.log(`Updating pattern ${patternId} for game ${gameNumber} with:`, updates);
    const configIndex = gameConfigs.findIndex(c => c.gameNumber === gameNumber);
    
    if (configIndex < 0) {
      console.error(`Game number ${gameNumber} not found in configs`);
      return false;
    }
    
    const currentConfig = gameConfigs[configIndex];
    
    const patterns = currentConfig.patterns || {};
    
    let patternConfig = patterns[patternId];
    if (!patternConfig) {
      patternConfig = {
        active: false,
        isNonCash: false,
        prizeAmount: '10.00',
        description: `${patternId} Prize`
      };
    }
    
    const updatedPattern = { ...patternConfig, ...updates };
    
    const updatedPatterns = { ...patterns, [patternId]: updatedPattern };
    const updatedConfig = { ...currentConfig, patterns: updatedPatterns };
    
    const newConfigs = [...gameConfigs];
    newConfigs[configIndex] = updatedConfig;
    
    return await saveGameConfigs(newConfigs);
  }, [gameConfigs, saveGameConfigs]);

  const getActivePatterns = useCallback((gameNumber: number): string[] => {
    const config = gameConfigs.find(c => c.gameNumber === gameNumber);
    if (!config) return [];
    
    return Object.entries(config.patterns || {})
      .filter(([_, pattern]) => pattern.active === true)
      .map(([id]) => id);
  }, [gameConfigs]);

  const getCurrentGamePatterns = useCallback((currentGame: number): Record<string, WinPatternConfig> => {
    const config = gameConfigs.find(c => c.gameNumber === currentGame);
    return config?.patterns || {};
  }, [gameConfigs]);

  function createDefaultGameConfig(
    gameNumber: number, 
    gameType: GameType = 'mainstage', 
    sessionId?: string,
    activateFirstPattern: boolean = false
  ): GameConfig {
    console.log(`Creating default game config for game ${gameNumber}, type ${gameType}, activateFirstPattern: ${activateFirstPattern}`);
    const patterns: Record<string, WinPatternConfig> = {};
    
    const defaultPatterns = getDefaultPatternsForType(gameType);
    defaultPatterns.forEach((patternId) => {
      patterns[patternId] = {
        active: false,
        isNonCash: false,
        prizeAmount: '10.00',
        description: `${patternId} Prize`
      };
    });
    
    return {
      gameNumber,
      gameType,
      patterns,
      session_id: sessionId
    };
  }

  useEffect(() => {
    if (!isInitialized) {
      fetchGameConfigs();
    }
  }, [fetchGameConfigs, isInitialized]);

  return {
    gameConfigs,
    fetchGameConfigs,
    saveGameConfigs,
    updateGameConfig,
    updateWinPattern,
    getActivePatterns,
    getCurrentGamePatterns,
    isLoading,
    error,
    isInitialized
  };
}
