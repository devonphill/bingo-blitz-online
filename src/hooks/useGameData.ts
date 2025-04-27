
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameConfiguration, GamePattern, CalledItem, GameType } from '@/types';

export function useGameData(sessionId?: string, gameNumber?: number) {
  const [configuration, setConfiguration] = useState<GameConfiguration | null>(null);
  const [patterns, setPatterns] = useState<GamePattern[]>([]);
  const [calledItems, setCalledItems] = useState<CalledItem[]>([]);
  const [lastCalledItem, setLastCalledItem] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePattern, setActivePattern] = useState<string | null>(null);
  
  const fetchGameData = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get the current game number if not provided
      let currentGameNumber = gameNumber;
      if (!currentGameNumber) {
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions_progress')
          .select('current_game_number')
          .eq('session_id', sessionId)
          .single();

        if (sessionError) {
          throw new Error(`Error fetching current game: ${sessionError.message}`);
        }
        currentGameNumber = sessionData?.current_game_number || 1;
      }

      // Fetch game configuration
      const { data: configData, error: configError } = await supabase
        .from('game_configurations')
        .select('*')
        .eq('session_id', sessionId)
        .eq('game_number', currentGameNumber)
        .single();

      if (configError) {
        console.error("Error fetching game configuration:", configError);
        // Fallback to session data if new table data isn't available
        const { data: sessionData, error: sessionError } = await supabase
          .from('game_sessions')
          .select('current_game_state, game_type, active_pattern_id')
          .eq('id', sessionId)
          .single();
          
        if (sessionError) {
          throw new Error(`Error fetching session data: ${sessionError.message}`);
        }
        
        // Get active pattern from session
        if (sessionData?.active_pattern_id) {
          setActivePattern(sessionData.active_pattern_id);
        } else if (sessionData?.current_game_state?.activePatternIds?.length > 0) {
          setActivePattern(sessionData.current_game_state.activePatternIds[0]);
        }
        
        // Create a fallback configuration
        if (sessionData) {
          setConfiguration({
            id: 'legacy',
            session_id: sessionId,
            game_number: currentGameNumber as number,
            game_type: (sessionData.current_game_state?.gameType || sessionData.game_type) as GameType,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          
          // Set legacy called items
          if (sessionData.current_game_state?.calledItems) {
            const legacyCalledItems = sessionData.current_game_state.calledItems.map((item: any, index: number) => ({
              id: `legacy-${index}`,
              session_id: sessionId,
              game_number: currentGameNumber as number,
              item_value: item,
              called_at: new Date().toISOString(),
              call_order: index + 1
            }));
            setCalledItems(legacyCalledItems);
            
            if (legacyCalledItems.length > 0) {
              setLastCalledItem(legacyCalledItems[legacyCalledItems.length - 1].item_value);
            }
          }
        }
      } else {
        // Set the configuration data
        setConfiguration(configData);
        
        // Fetch patterns for the configuration
        const { data: patternsData, error: patternsError } = await supabase
          .from('game_patterns')
          .select('*')
          .eq('game_config_id', configData.id)
          .order('pattern_order', { ascending: true });

        if (patternsError) {
          console.error("Error fetching patterns:", patternsError);
        } else if (patternsData && patternsData.length > 0) {
          setPatterns(patternsData);
          
          // Get the active pattern from the session
          const { data: sessionData } = await supabase
            .from('game_sessions')
            .select('active_pattern_id')
            .eq('id', sessionId)
            .single();
            
          if (sessionData?.active_pattern_id) {
            setActivePattern(sessionData.active_pattern_id);
          } else {
            // Default to the first pattern
            setActivePattern(patternsData[0].pattern_id);
          }
        }
        
        // Fetch called items
        const { data: calledItemsData, error: calledItemsError } = await supabase
          .from('called_items')
          .select('*')
          .eq('session_id', sessionId)
          .eq('game_number', currentGameNumber)
          .order('call_order', { ascending: true });

        if (calledItemsError) {
          console.error("Error fetching called items:", calledItemsError);
        } else if (calledItemsData) {
          setCalledItems(calledItemsData);
          
          if (calledItemsData.length > 0) {
            setLastCalledItem(calledItemsData[calledItemsData.length - 1].item_value);
          }
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
      
      // Insert the new called item
      const { data, error } = await supabase
        .from('called_items')
        .insert({
          session_id: sessionId,
          game_number: configuration.game_number,
          item_value: newNumber,
          call_order: existingNumbers.length + 1
        })
        .select()
        .single();
        
      if (error) {
        console.error("Error calling number:", error);
        // Legacy fallback
        const { error: updateError } = await supabase
          .from('game_sessions')
          .update({
            'current_game_state': {
              ...configuration,
              calledItems: [...existingNumbers, newNumber],
              lastCalledItem: newNumber
            }
          })
          .eq('id', sessionId);
          
        if (updateError) {
          console.error("Error in legacy call number update:", updateError);
          return null;
        }
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
      // Find the current pattern index
      const currentPatternIndex = patterns.findIndex(p => p.pattern_id === activePattern);
      
      // Check if there is a next pattern
      if (currentPatternIndex < 0 || currentPatternIndex >= patterns.length - 1) {
        console.log("No next pattern available");
        return false;
      }
      
      const nextPattern = patterns[currentPatternIndex + 1];
      
      // Update the active pattern in the database
      const { error } = await supabase
        .from('game_sessions')
        .update({
          active_pattern_id: nextPattern.pattern_id
        })
        .eq('id', sessionId);
        
      if (error) {
        console.error("Error updating active pattern:", error);
        return false;
      }
      
      // Update the session progress
      const { error: progressError } = await supabase
        .from('sessions_progress')
        .update({
          current_win_pattern: nextPattern.pattern_id
        })
        .eq('session_id', sessionId);
        
      if (progressError) {
        console.error("Error updating session progress:", progressError);
      }
      
      // Update local state
      setActivePattern(nextPattern.pattern_id);
      
      return true;
    } catch (err) {
      console.error("Error in progressToNextPattern:", err);
      return false;
    }
  }, [sessionId, configuration, activePattern, patterns]);

  // Progress to next game
  const progressToNextGame = useCallback(async (): Promise<boolean> => {
    if (!sessionId || !configuration) return false;
    
    try {
      // Get the current max game number
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
      
      // Get the next game configuration
      const { data: nextConfigData, error: nextConfigError } = await supabase
        .from('game_configurations')
        .select('*')
        .eq('session_id', sessionId)
        .eq('game_number', nextGameNumber)
        .single();
        
      if (nextConfigError) {
        console.error("Error fetching next game configuration:", nextConfigError);
        return false;
      }
      
      // Get the first pattern for the next game
      const { data: nextPatternsData, error: nextPatternsError } = await supabase
        .from('game_patterns')
        .select('*')
        .eq('game_config_id', nextConfigData.id)
        .order('pattern_order', { ascending: true })
        .limit(1);
        
      if (nextPatternsError) {
        console.error("Error fetching next game patterns:", nextPatternsError);
        return false;
      }
      
      const firstPatternId = nextPatternsData.length > 0 
        ? nextPatternsData[0].pattern_id 
        : null;
        
      // Update session progress
      const { error: updateProgressError } = await supabase
        .from('sessions_progress')
        .update({
          current_game_number: nextGameNumber,
          current_win_pattern: firstPatternId
        })
        .eq('session_id', sessionId);
        
      if (updateProgressError) {
        console.error("Error updating session progress:", updateProgressError);
        return false;
      }
      
      // Update game session
      const { error: updateSessionError } = await supabase
        .from('game_sessions')
        .update({
          current_game: nextGameNumber,
          active_pattern_id: firstPatternId
        })
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
  }, [sessionId, configuration]);

  // Set up real-time subscription for changes to called items
  useEffect(() => {
    if (!sessionId) return;
    
    fetchGameData();
    
    const channel = supabase
      .channel(`called-items-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'called_items',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('New called item:', payload);
          const newItem = payload.new as CalledItem;
          
          // Update the called items and last called item
          setCalledItems(prev => {
            // Avoid duplicates
            if (prev.some(item => item.id === newItem.id)) {
              return prev;
            }
            return [...prev, newItem];
          });
          
          setLastCalledItem(newItem.item_value);
        }
      )
      .subscribe();
      
    // Also subscribe to changes in the active pattern
    const patternChannel = supabase
      .channel(`active-pattern-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          const updatedSession = payload.new as any;
          if (updatedSession.active_pattern_id !== activePattern) {
            setActivePattern(updatedSession.active_pattern_id);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(patternChannel);
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
    fetchGameData
  };
}
