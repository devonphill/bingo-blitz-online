
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
    if (!sessionId) {
      console.log("No sessionId provided to fetchGameConfigs");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching game configs for session: ${sessionId}`);
      const { data, error: fetchError } = await supabase
        .from('game_sessions')
        .select('games_config, current_game, game_type, number_of_games')
        .eq('id', sessionId)
        .single();

      if (fetchError) {
        console.error('Database fetch error:', fetchError);
        throw new Error(`Database error: ${fetchError.message}`);
      }

      console.log("Raw session data from database:", data);
      
      let configs: GameConfig[] = [];
      const numberOfGames = data.number_of_games || 1;
      const gameType = data.game_type || 'mainstage';
      
      if (data.games_config) {
        // Detailed logging to see exactly what's in the database
        console.log("Raw games_config from database:", 
          typeof data.games_config === 'string' ? data.games_config : JSON.stringify(data.games_config));
        
        try {
          configs = jsonToGameConfigs(data.games_config);
          console.log("Parsed game configs:", configs);
        } catch (parseError) {
          console.error("Error parsing games_config:", parseError);
          throw new Error(`Failed to parse game configurations: ${(parseError as Error).message}`);
        }
      } else {
        console.log("No games_config found in database, will create default configs");
      }
      
      // If we need more configs than we have, create the missing ones
      if (configs.length < numberOfGames) {
        console.log(`Creating default configs for missing games (${numberOfGames} required, ${configs.length} found)`);
        
        const newConfigs = Array.from({ length: numberOfGames }, (_, i) => {
          const gameNumber = i + 1;
          
          // Use existing config if available
          if (i < configs.length && configs[i]) {
            console.log(`Using existing config for game ${gameNumber}:`, configs[i]);
            return configs[i];
          }
          
          // Create new config with NO ACTIVE PATTERNS
          console.log(`Creating new default config for game ${gameNumber} with NO active patterns`);
          return createDefaultGameConfig(gameNumber, gameType as GameType, sessionId, false);
        });
        
        configs = newConfigs;
        console.log("Final configs after adding missing games:", configs);
      }

      setGameConfigs(configs);
      setIsInitialized(true);
    } catch (err) {
      const errorMessage = `Failed to fetch game configurations: ${(err as Error).message}`;
      console.error(errorMessage);
      setError(errorMessage);
      toast({
        title: "Error Loading Game Config",
        description: errorMessage,
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

    setIsLoading(true);
    
    try {
      console.log("Attempting to save game configs to database:", configs);
      
      // Ensure all configs have the session_id
      const configsWithSessionId = configs.map(config => ({
        ...config,
        session_id: sessionId
      }));
      
      // Convert to JSON format for database storage
      let jsonConfigs;
      try {
        jsonConfigs = gameConfigsToJson(configsWithSessionId);
      } catch (jsonError) {
        console.error("Failed to convert configs to JSON:", jsonError);
        throw new Error(`JSON conversion error: ${(jsonError as Error).message}`);
      }
      
      console.log("JSON configs to save to database:", jsonConfigs);
      
      // Save to database
      const { error: saveError } = await supabase
        .from('game_sessions')
        .update({ games_config: jsonConfigs })
        .eq('id', sessionId);

      if (saveError) {
        console.error("Database error saving game configs:", saveError);
        throw new Error(`Database error: ${saveError.message}`);
      }
      
      console.log("Game configs saved successfully to database");
      setGameConfigs(configsWithSessionId);
      return true;
    } catch (err) {
      const errorMessage = `Failed to save game configurations: ${(err as Error).message}`;
      console.error(errorMessage);
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
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
    
    console.log("Saving updated configs with pattern change:", newConfigs);
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
        active: false, // Always false by default - no pattern active unless explicitly set
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

  // Fetch game configs on initialization
  useEffect(() => {
    if (!isInitialized && sessionId) {
      console.log("useGameData: Initial fetch of game configs");
      fetchGameConfigs();
    }
  }, [fetchGameConfigs, isInitialized, sessionId]);

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
