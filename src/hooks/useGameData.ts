import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameType, CalledItem, GameConfig, WinPatternConfig } from '@/types';
import { Json } from '@/types/json';

export function useGameData(sessionId?: string, gameNumber?: number) {
  const [configuration, setConfiguration] = useState<any | null>(null);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [calledItems, setCalledItems] = useState<CalledItem[]>([]);
  const [lastCalledItem, setLastCalledItem] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePattern, setActivePattern] = useState<string | null>(null);
  const [gameConfigs, setGameConfigs] = useState<GameConfig[]>([]);
  
  const fetchGameData = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get the current game number and active pattern from sessions_progress
      const { data: progressData, error: progressError } = await supabase
        .from('sessions_progress')
        .select('current_game_number, current_win_pattern, current_game_type, max_game_number')
        .eq('session_id', sessionId)
        .single();

      if (progressError && progressError.code !== 'PGRST116') {
        throw new Error(`Error fetching current game: ${progressError.message}`);
      }

      const currentGameNumber = progressData?.current_game_number || gameNumber || 1;
      setActivePattern(progressData?.current_win_pattern || null);

      // Fetch game configuration from game_sessions
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .select('game_type, games_config, current_game')
        .eq('id', sessionId)
        .single();
          
      if (sessionError) {
        throw new Error(`Error fetching session data: ${sessionError.message}`);
      }
      
      // Set configuration from session data
      setConfiguration({
        id: 'legacy',
        session_id: sessionId,
        game_number: currentGameNumber || 1,
        game_type: (sessionData?.game_type as GameType) || 'mainstage',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      // Parse game configs
      if (sessionData?.games_config && Array.isArray(sessionData.games_config)) {
        const configs = sessionData.games_config as any[];
        
        // Check if we're using the new or old format
        if (configs.length > 0) {
          if ('patterns' in configs[0]) {
            // New format
            setGameConfigs(configs as GameConfig[]);
            
            // Extract pattern info for current game from new format
            const currentGameConfig = configs.find(c => c.gameNumber === currentGameNumber);
            if (currentGameConfig && currentGameConfig.patterns) {
              const extractedPatterns: any[] = [];
              
              // Safely access and iterate through patterns
              Object.entries(currentGameConfig.patterns)
                .filter(([_, configValue]) => {
                  if (!configValue || typeof configValue !== 'object') return false;
                  // Safely check if config has active property and it's true
                  return 'active' in configValue && configValue.active === true;
                })
                .forEach(([patternId, configValue], index) => {
                  if (!configValue || typeof configValue !== 'object') return;
                  
                  const config = configValue as Record<string, any>;
                  extractedPatterns.push({
                    id: `pattern-${patternId}`,
                    game_config_id: 'legacy',
                    pattern_id: patternId,
                    pattern_order: index,
                    prize_amount: config.prizeAmount || '10.00',
                    prize_description: config.description || '',
                    is_non_cash: config.isNonCash || false,
                    created_at: new Date().toISOString()
                  });
                });
              
              setPatterns(extractedPatterns);
            }
          } else if ('selectedPatterns' in configs[0]) {
            // Old format - convert to new format
            const convertedConfigs: GameConfig[] = configs.map((oldConfig: any) => {
              const patterns: Record<string, WinPatternConfig> = {};
              
              // Get all possible patterns for this game type
              const gameType = oldConfig.gameType || 'mainstage';
              const allPatterns = (oldConfig.selectedPatterns || []).concat(
                Object.keys(oldConfig.prizes || {})
              );
              
              // Set up each pattern
              const uniquePatterns = [...new Set(allPatterns)];
              uniquePatterns.forEach(patternId => {
                const prizeInfo = oldConfig.prizes && oldConfig.prizes[patternId];
                const isSelected = Array.isArray(oldConfig.selectedPatterns) && 
                                  oldConfig.selectedPatterns.includes(patternId);
                
                patterns[patternId] = {
                  active: isSelected,
                  isNonCash: prizeInfo?.isNonCash || false,
                  prizeAmount: prizeInfo?.amount || '10.00',
                  description: prizeInfo?.description || `${patternId} Prize`
                };
              });
              
              return {
                gameNumber: oldConfig.gameNumber,
                gameType: oldConfig.gameType,
                patterns: patterns
              };
            });
            
            setGameConfigs(convertedConfigs);
            
            // Extract pattern info for current game from converted format
            const currentGameConfig = convertedConfigs.find(c => c.gameNumber === currentGameNumber);
            if (currentGameConfig) {
              const extractedPatterns: any[] = [];
              
              Object.entries(currentGameConfig.patterns)
                .filter(([_, config]) => config.active)
                .forEach(([patternId, config], index) => {
                  extractedPatterns.push({
                    id: `pattern-${patternId}`,
                    game_config_id: 'legacy',
                    pattern_id: patternId,
                    pattern_order: index,
                    prize_amount: config.prizeAmount,
                    prize_description: config.description,
                    is_non_cash: config.isNonCash,
                    created_at: new Date().toISOString()
                  });
                });
              
              setPatterns(extractedPatterns);
            }
          }
        }
      }

      // Get called numbers from the session's called_items field
      const { data: sessionWithCalledItems, error: calledItemsError } = await supabase
        .from('game_sessions')
        .select('called_items')
        .eq('id', sessionId)
        .single();
        
      if (!calledItemsError && sessionWithCalledItems?.called_items) {
        try {
          // Parse the called_items JSON string if available
          let parsedCalledItems: CalledItem[] = [];
          
          try {
            if (typeof sessionWithCalledItems.called_items === 'string') {
              parsedCalledItems = JSON.parse(sessionWithCalledItems.called_items);
            } else if (Array.isArray(sessionWithCalledItems.called_items)) {
              parsedCalledItems = sessionWithCalledItems.called_items;
            }
          } catch (parseError) {
            console.error("Error parsing called items:", parseError);
          }
          
          if (Array.isArray(parsedCalledItems) && parsedCalledItems.length > 0) {
            setCalledItems(parsedCalledItems.map((item, index) => ({
              id: item.id || `item-${index}`,
              session_id: item.session_id || sessionId,
              game_number: currentGameNumber || 1,
              value: item.value,
              timestamp: item.timestamp || new Date().toISOString(),
              call_order: item.call_order || index + 1
            })));
            
            if (parsedCalledItems.length > 0) {
              setLastCalledItem(parsedCalledItems[parsedCalledItems.length - 1].value);
            }
          }
        } catch (err) {
          console.error("Error processing called items:", err);
        }
      }
    } catch (err) {
      console.error("Error in fetchGameData:", err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [sessionId, gameNumber]);

  // Call number function
  const callNumber = useCallback(async (gameType: GameType): Promise<number | null> => {
    if (!sessionId || !configuration) return null;
    
    try {
      const numberRange = gameType === 'mainstage' ? 90 : 75;
      const existingNumbers = calledItems.map(item => item.value);
      
      // Check if we've called all possible numbers
      if (existingNumbers.length >= numberRange) {
        console.error("All numbers have been called");
        return null;
      }
      
      // Generate a new unique number
      let newNumber;
      do {
        newNumber = Math.floor(Math.random() * numberRange) + 1;
      } while (existingNumbers.includes(newNumber));
      
      // Create new called item
      const newCalledItem: CalledItem = {
        id: `item-${Date.now()}`,
        session_id: sessionId,
        game_number: configuration.game_number,
        value: newNumber,
        timestamp: new Date().toISOString(),
        call_order: existingNumbers.length + 1
      };
      
      // Update calledItems in state
      const updatedCalledItems = [...calledItems, newCalledItem];
      setCalledItems(updatedCalledItems);
      setLastCalledItem(newNumber);
      
      // Update the called_items in the game_sessions table
      const { error } = await supabase
        .from('game_sessions')
        .update({
          called_items: JSON.stringify(updatedCalledItems)
        })
        .eq('id', sessionId);
        
      if (error) {
        console.error("Error updating called items:", error);
        return null;
      }
      
      return newNumber;
    } catch (err) {
      console.error("Error in callNumber:", err);
      return null;
    }
  }, [sessionId, configuration, calledItems]);

  // Progress to next pattern
  const progressToNextPattern = useCallback(async (): Promise<boolean> => {
    if (!sessionId || !configuration || !activePattern) return false;
    
    try {
      const currentGameConfig = gameConfigs.find(config => config.gameNumber === configuration.game_number);
      if (!currentGameConfig) return false;
      
      // Get active patterns for this game
      const activePatternIds = Object.entries(currentGameConfig.patterns)
        .filter(([_, config]) => config.active)
        .map(([patternId]) => patternId);
      
      // Find the current pattern index
      const currentPatternIndex = activePatternIds.indexOf(activePattern);
      
      // Check if there is a next pattern
      if (currentPatternIndex < 0 || currentPatternIndex >= activePatternIds.length - 1) {
        console.log("No next pattern available");
        return false;
      }
      
      const nextPattern = activePatternIds[currentPatternIndex + 1];
      
      // Update the active pattern in the sessions_progress table
      const { error: progressError } = await supabase
        .from('sessions_progress')
        .update({
          current_win_pattern: nextPattern
        })
        .eq('session_id', sessionId);
        
      if (progressError) {
        console.error("Error updating session progress:", progressError);
        return false;
      }
      
      // Update session with active pattern
      const updateData: Partial<any> = {
        active_pattern_id: nextPattern
      };
      
      const { error: sessionError } = await supabase
        .from('game_sessions')
        .update(updateData)
        .eq('id', sessionId);
        
      if (sessionError) {
        console.error("Error updating game session:", sessionError);
        return false;
      }
      
      // Update local state
      setActivePattern(nextPattern);
      
      return true;
    } catch (err) {
      console.error("Error in progressToNextPattern:", err);
      return false;
    }
  }, [sessionId, configuration, activePattern, gameConfigs]);

  // Progress to next game
  const progressToNextGame = useCallback(async (): Promise<boolean> => {
    if (!sessionId || !configuration) return false;
    
    try {
      // Get the current progress data
      const { data: progressData, error: progressError } = await supabase
        .from('sessions_progress')
        .select('current_game_number, max_game_number')
        .eq('session_id', sessionId)
        .single();
        
      if (progressError) {
        console.error("Error fetching session progress:", progressError);
        return false;
      }
      
      const currentGameNumber = progressData.current_game_number;
      const maxGameNumber = progressData.max_game_number;
      
      // Check if we're already at the last game
      if (currentGameNumber >= maxGameNumber) {
        console.log("Already at the last game");
        
        // Mark the session as completed
        const { error: updateError } = await supabase
          .from('game_sessions')
          .update({ 
            status: 'completed',
            lifecycle_state: 'ended'
          })
          .eq('id', sessionId);
          
        if (updateError) {
          console.error("Error completing session:", updateError);
          return false;
        }
        
        return false;
      }
      
      const nextGameNumber = currentGameNumber + 1;
      
      // Get the first active pattern for the next game
      const nextGameConfig = gameConfigs.find(config => config.gameNumber === nextGameNumber);
      let firstPatternId = 'oneLine'; // Default pattern
      
      if (nextGameConfig) {
        const activePatterns = Object.entries(nextGameConfig.patterns)
          .filter(([_, config]) => config.active)
          .map(([patternId]) => patternId);
        
        if (activePatterns.length > 0) {
          firstPatternId = activePatterns[0];
        }
      }
      
      // Update session progress
      const { error: updateProgressError } = await supabase
        .from('sessions_progress')
        .update({
          current_game_number: nextGameNumber,
          current_win_pattern: firstPatternId,
          current_game_type: nextGameConfig?.gameType || 'mainstage'
        })
        .eq('session_id', sessionId);
        
      if (updateProgressError) {
        console.error("Error updating session progress:", updateProgressError);
        return false;
      }
      
      // Update game session
      const updateData: Partial<any> = {
        current_game: nextGameNumber,
        active_pattern_id: firstPatternId
      };
      
      const { error: updateSessionError } = await supabase
        .from('game_sessions')
        .update(updateData)
        .eq('id', sessionId);
        
      if (updateSessionError) {
        console.error("Error updating game session:", updateSessionError);
        return false;
      }
      
      // Force page reload to update all state
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
      
      return true;
    } catch (err) {
      console.error("Error in progressToNextGame:", err);
      return false;
    }
  }, [sessionId, configuration, gameConfigs]);

  // Set up subscription for changes to called items
  useEffect(() => {
    if (!sessionId) return;
    
    fetchGameData();
    
    // Subscribe to game_sessions changes to detect when called_items are updated
    const channel = supabase
      .channel(`game-sessions-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          console.log('Game session updated:', payload);
          
          if (payload.new && 'called_items' in payload.new) {
            try {
              const newCalledItems = JSON.parse(payload.new.called_items as string);
              if (Array.isArray(newCalledItems) && newCalledItems.length > 0) {
                setCalledItems(newCalledItems);
                setLastCalledItem(newCalledItems[newCalledItems.length - 1].value);
              }
            } catch (err) {
              console.error("Error processing updated called items:", err);
            }
          }
        }
      )
      .subscribe();
      
    // Subscribe to progress changes for active pattern updates
    const progressChannel = supabase
      .channel(`progress-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions_progress',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('Sessions progress updated:', payload);
          if (payload.new && 'current_win_pattern' in payload.new && payload.new.current_win_pattern) {
            setActivePattern(payload.new.current_win_pattern);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(progressChannel);
    };
  }, [sessionId, fetchGameData]);
  
  return {
    configuration,
    patterns,
    calledItems,
    lastCalledItem,
    activePattern,
    loading,
    error,
    callNumber,
    progressToNextPattern,
    progressToNextGame,
    fetchGameData,
    gameConfigs
  };
}
