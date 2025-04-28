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

      if (error) {
        throw error;
      }

      console.log("Fetched session data:", data);
      let configs: GameConfig[] = [];
      const numberOfGames = data.number_of_games || 1;
      const gameType = data.game_type || 'mainstage';
      
      // Check if games_config exists and is not empty
      if (data.games_config && (
          (Array.isArray(data.games_config) && data.games_config.length > 0) || 
          (typeof data.games_config === 'object' && Object.keys(data.games_config).length > 0)
      )) {
        console.log("Using existing games_config from database:", data.games_config);
        configs = jsonToGameConfigs(data.games_config);
        console.log("Parsed game configs:", configs);
      } 
      
      // If no configs or fewer configs than needed, create defaults with NO active patterns
      if (configs.length < numberOfGames) {
        console.log("Creating default configs for missing games - NO ACTIVE PATTERNS");
        
        // Keep existing configs and add new ones as needed
        const newConfigs = Array.from({ length: numberOfGames }, (_, i) => {
          const gameNumber = i + 1;
          
          // Use existing config if available
          if (i < configs.length && configs[i]) {
            return configs[i];
          }
          
          // Otherwise create a default config with NO active patterns
          return createDefaultGameConfig(gameNumber, gameType as GameType, sessionId, false);
        });
        
        configs = newConfigs;
        console.log("Created game configs:", configs);
        
        // Save these default configs to the database
        const jsonConfigs = gameConfigsToJson(configs);
        console.log("Saving default configs to database:", jsonConfigs);
        
        const { error: saveError } = await supabase
          .from('game_sessions')
          .update({ games_config: jsonConfigs })
          .eq('id', sessionId);
          
        if (saveError) {
          console.error("Error saving default game configs:", saveError);
          toast({
            title: "Error",
            description: "Failed to save default game configurations",
            variant: "destructive"
          });
        } else {
          console.log("Saved default game configs to database");
        }
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
      
      // Ensure session_id is set on all configs
      const configsWithSessionId = configs.map(config => ({
        ...config,
        session_id: sessionId
      }));
      
      // Convert to JSON-compatible format using utility function
      const jsonConfigs = gameConfigsToJson(configsWithSessionId);
      console.log("JSON configs to save:", jsonConfigs);
      
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
      toast({
        title: "Success",
        description: "Game configurations saved successfully",
      });
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

  /**
   * Helper function to create a default game configuration
   * @param gameNumber The game number
   * @param gameType The game type
   * @param sessionId Optional session ID
   * @param activateFirstPattern Whether to activate the first pattern by default
   * @returns A default GameConfig
   */
  function createDefaultGameConfig(
    gameNumber: number, 
    gameType: GameType = 'mainstage', 
    sessionId?: string,
    activateFirstPattern: boolean = false
  ): GameConfig {
    console.log(`Creating default game config for game ${gameNumber}, type ${gameType}, activateFirstPattern: ${activateFirstPattern}`);
    const patterns: Record<string, WinPatternConfig> = {};
    
    const defaultPatterns = getDefaultPatternsForType(gameType);
    defaultPatterns.forEach(patternId => {
      patterns[patternId] = {
        // IMPORTANT: Always initialize as false unless specifically requested otherwise
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
