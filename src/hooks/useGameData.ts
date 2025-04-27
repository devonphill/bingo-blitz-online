import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameConfiguration, GamePattern, CalledItem, GameType, GameConfig } from '@/types';
import { Json, isOfType, GameConfigurationType, GamePatternType, CalledItemType, SessionWithActivePattern, WinPatternConfig, isGameConfigItem } from '@/types/json';
import { getPatternConfig } from '@/types/json';

// Existing type guard functions
const isGamePattern = (obj: any): obj is GamePattern => {
  return isOfType<GamePattern>(obj, ['pattern_id', 'game_config_id']);
};

const isCalledItem = (obj: any): obj is CalledItem => {
  return isOfType<CalledItem>(obj, ['item_value', 'session_id']);
};

export function useGameData(sessionId?: string, gameNumber?: number) {
  const [configuration, setConfiguration] = useState<GameConfiguration | null>(null);
  const [patterns, setPatterns] = useState<GamePattern[]>([]);
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
              const extractedPatterns: GamePattern[] = [];
              
              // Safely access and iterate through patterns
              Object.entries(currentGameConfig.patterns)
                .filter(([_, config]) => {
                  // Safely check if config has active property and it's true
                  return config && typeof config === 'object' && 'active' in config && config.active === true;
                })
                .forEach(([patternId, config], index) => {
                  if (config && typeof config === 'object') {
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
                  }
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
              const extractedPatterns: GamePattern[] = [];
              
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

      // Fetch called items from the called_numbers table
      const { data: calledNumbersData, error: calledNumbersError } = await supabase
        .from('called_numbers')
        .select('*')
        .eq('session_id', sessionId)
        .order('called_at', { ascending: true });
        
      if (!calledNumbersError && calledNumbersData && calledNumbersData.length > 0) {
        const mappedCalledItems: CalledItem[] = calledNumbersData.map((item: any, index: number) => ({
          id: item.id,
          session_id: item.session_id,
          game_number: currentGameNumber || 1,
          item_value: item.number,
          called_at: item.called_at,
          call_order: index + 1
        }));
        
        setCalledItems(mappedCalledItems);
        
        if (mappedCalledItems.length > 0) {
          setLastCalledItem(mappedCalledItems[mappedCalledItems.length - 1].item_value);
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
      const existingNumbers = calledItems.map(item => item.item_value);
      
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
      
      // Insert into called_numbers table
      const { data, error } = await supabase
        .from('called_numbers')
        .insert({
          session_id: sessionId,
          number: newNumber
        })
        .select()
        .single();
        
      if (error) {
        console.error("Error calling number:", error);
        return null;
      }
      
      // Update local state
      setLastCalledItem(newNumber);
      setCalledItems(prev => [
        ...prev, 
        { 
          id: data?.id || `temp-${Date.now()}`,
          session_id: sessionId,
          game_number: configuration.game_number,
          item_value: newNumber,
          called_at: new Date().toISOString(),
          call_order: existingNumbers.length + 1
        }
      ]);
      
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
      const updateData: Partial<SessionWithActivePattern> = {
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
      const updateData: Partial<SessionWithActivePattern> = {
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

  // Set up real-time subscription for changes to called items
  useEffect(() => {
    if (!sessionId) return;
    
    fetchGameData();
    
    // Subscribe to called_numbers changes
    const channel = supabase
      .channel(`called-numbers-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'called_numbers',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('New called number:', payload);
          
          if (payload.new) {
            const newNumber = payload.new.number;
            const callOrder = calledItems.length + 1;
            
            const newItem: CalledItem = {
              id: payload.new.id,
              session_id: sessionId,
              game_number: configuration?.game_number || 1,
              item_value: newNumber,
              called_at: payload.new.called_at,
              call_order: callOrder
            };
            
            // Update the called items and last called item
            setCalledItems(prev => {
              // Avoid duplicates
              if (prev.some(item => item.id === newItem.id)) {
                return prev;
              }
              return [...prev, newItem];
            });
            
            setLastCalledItem(newNumber);
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
