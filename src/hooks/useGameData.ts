
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameConfiguration, GamePattern, CalledItem, GameType } from '@/types';

// Type guard function to check if an object is a GamePattern
const isGamePattern = (obj: any): obj is GamePattern => {
  return obj && typeof obj.pattern_id === 'string' && typeof obj.game_config_id === 'string';
};

// Type guard function to check if an object is a CalledItem
const isCalledItem = (obj: any): obj is CalledItem => {
  return obj && typeof obj.item_value === 'number' && typeof obj.session_id === 'string';
};

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

      // Fetch game configuration - must use any type temporarily
      const { data: configData, error: configError } = await supabase
        .from('game_configurations' as any)
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
        
        // Type assertion for sessionData
        const typedSessionData = sessionData as any;
        
        // Get active pattern from session
        if (typedSessionData?.active_pattern_id) {
          setActivePattern(typedSessionData.active_pattern_id);
        } else if (typedSessionData?.current_game_state?.activePatternIds?.length > 0) {
          setActivePattern(typedSessionData.current_game_state.activePatternIds[0]);
        }
        
        // Create a fallback configuration
        if (typedSessionData) {
          setConfiguration({
            id: 'legacy',
            session_id: sessionId,
            game_number: currentGameNumber as number,
            game_type: (typedSessionData.current_game_state?.gameType || typedSessionData.game_type) as GameType,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          
          // Set legacy called items
          if (typedSessionData.current_game_state?.calledItems) {
            const legacyCalledItems = typedSessionData.current_game_state.calledItems.map((item: any, index: number) => ({
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
        // Type assertion for configData
        const typedConfigData = configData as any;
        
        // Set the configuration data
        setConfiguration({
          id: typedConfigData.id,
          session_id: typedConfigData.session_id,
          game_number: typedConfigData.game_number,
          game_type: typedConfigData.game_type as GameType,
          created_at: typedConfigData.created_at,
          updated_at: typedConfigData.updated_at
        });
        
        // Fetch patterns for the configuration
        const { data: patternsData, error: patternsError } = await supabase
          .from('game_patterns' as any)
          .select('*')
          .eq('game_config_id', typedConfigData.id)
          .order('pattern_order', { ascending: true });

        if (patternsError) {
          console.error("Error fetching patterns:", patternsError);
        } else if (patternsData) {
          // Convert to GamePattern type - use type assertion
          const typedPatterns: GamePattern[] = (patternsData as any[]).map(p => ({
            id: p.id,
            game_config_id: p.game_config_id,
            pattern_id: p.pattern_id,
            pattern_order: p.pattern_order,
            prize_amount: p.prize_amount,
            prize_description: p.prize_description,
            is_non_cash: p.is_non_cash,
            created_at: p.created_at
          }));
          
          setPatterns(typedPatterns);
          
          // Get the active pattern from the session
          const { data: sessionData } = await supabase
            .from('game_sessions')
            .select('active_pattern_id')
            .eq('id', sessionId)
            .single();
            
          // Type assertion for sessionData
          const typedSessionData = sessionData as any;
            
          if (typedSessionData?.active_pattern_id) {
            setActivePattern(typedSessionData.active_pattern_id);
          } else {
            // Default to the first pattern
            setActivePattern(typedPatterns[0].pattern_id);
          }
        }
        
        // Fetch called items
        const { data: calledItemsData, error: calledItemsError } = await supabase
          .from('called_items' as any)
          .select('*')
          .eq('session_id', sessionId)
          .eq('game_number', currentGameNumber)
          .order('call_order', { ascending: true });

        if (calledItemsError) {
          console.error("Error fetching called items:", calledItemsError);
        } else if (calledItemsData) {
          // Convert to CalledItem type - use type assertion
          const typedCalledItems: CalledItem[] = (calledItemsData as any[]).map(c => ({
            id: c.id,
            session_id: c.session_id,
            game_number: c.game_number,
            item_value: c.item_value,
            called_at: c.called_at,
            call_order: c.call_order
          }));
          
          setCalledItems(typedCalledItems);
          
          if (typedCalledItems.length > 0) {
            setLastCalledItem(typedCalledItems[typedCalledItems.length - 1].item_value);
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
        .from('called_items' as any)
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
      
      // Type assertion for data
      const typedData = data as any;
      
      // Update local state
      setLastCalledItem(newNumber);
      setCalledItems(prev => [
        ...prev, 
        { 
          id: typedData?.id || `temp-${Date.now()}`,
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
      
      // Update the active pattern in the database - use type assertion
      const { error } = await supabase
        .from('game_sessions')
        .update({
          active_pattern_id: nextPattern.pattern_id as any
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
        .from('game_configurations' as any)
        .select('*')
        .eq('session_id', sessionId)
        .eq('game_number', nextGameNumber)
        .single();
        
      if (nextConfigError) {
        console.error("Error fetching next game configuration:", nextConfigError);
        return false;
      }
      
      // Type assertion for nextConfigData
      const typedNextConfigData = nextConfigData as any;
      
      // Get the first pattern for the next game
      const { data: nextPatternsData, error: nextPatternsError } = await supabase
        .from('game_patterns' as any)
        .select('*')
        .eq('game_config_id', typedNextConfigData.id)
        .order('pattern_order', { ascending: true })
        .limit(1);
        
      if (nextPatternsError) {
        console.error("Error fetching next game patterns:", nextPatternsError);
        return false;
      }
      
      // Type assertion for nextPatternsData
      const typedNextPatternsData = nextPatternsData as any[];
      
      const firstPatternId = typedNextPatternsData && typedNextPatternsData.length > 0 
        ? typedNextPatternsData[0].pattern_id 
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
      
      // Update game session - use type assertion for active_pattern_id
      const { error: updateSessionError } = await supabase
        .from('game_sessions')
        .update({
          current_game: nextGameNumber,
          active_pattern_id: firstPatternId as any
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
    
    // Use a string channel name for now and type assertion
    const channel = supabase
      .channel(`called-items-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'called_items',
          filter: `session_id=eq.${sessionId}`
        } as any, // Type assertion needed temporarily
        (payload) => {
          console.log('New called item:', payload);
          
          // We need to manually handle the payload since types don't match
          const newItem = {
            id: payload.new?.id,
            session_id: payload.new?.session_id,
            game_number: payload.new?.game_number,
            item_value: payload.new?.item_value,
            called_at: payload.new?.called_at,
            call_order: payload.new?.call_order
          } as CalledItem;
          
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
