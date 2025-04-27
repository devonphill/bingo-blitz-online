import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameConfiguration, GamePattern, CalledItem, GameType } from '@/types';
import { Json, isOfType, GameConfigurationType, GamePatternType, CalledItemType } from '@/types/json';

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
  
  const fetchGameData = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get the current game number from sessions_progress
      let currentGameNumber = gameNumber;
      const { data: progressData, error: progressError } = await supabase
        .from('sessions_progress')
        .select('current_game_number')
        .eq('session_id', sessionId)
        .single();

      if (progressError && progressError.code !== 'PGRST116') {
        throw new Error(`Error fetching current game: ${progressError.message}`);
      }

      currentGameNumber = progressData?.current_game_number || gameNumber || 1;

      // Fetch game configuration - use any type to bypass TypeScript checks temporarily
      const { data: configData, error: configError } = await (supabase
        .from('game_configurations' as any)
        .select('*')
        .eq('session_id', sessionId)
        .eq('game_number', currentGameNumber)
        .single() as any);

      if (configError) {
        console.error("Error fetching game configuration:", configError);
        
        // Fallback to session data
        const { data: sessionData, error: sessionError } = await supabase
          .from('game_sessions')
          .select('game_type, active_pattern_id, current_game_state')
          .eq('id', sessionId)
          .single();
          
        if (sessionError) {
          throw new Error(`Error fetching session data: ${sessionError.message}`);
        }
        
        // Set configuration from session data
        setConfiguration({
          id: 'legacy',
          session_id: sessionId,
          game_number: currentGameNumber,
          game_type: (sessionData?.game_type as GameType) || 'mainstage',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
        // Set active pattern
        if (sessionData?.active_pattern_id) {
          setActivePattern(sessionData.active_pattern_id);
        } else if (sessionData?.current_game_state && 'activePatternIds' in sessionData.current_game_state) {
          const activePatterns = (sessionData.current_game_state as any).activePatternIds;
          if (activePatterns && activePatterns.length > 0) {
            setActivePattern(activePatterns[0]);
          }
        }
      } else if (configData) {
        // Convert configData to GameConfiguration type
        const typedConfigData = configData as unknown as GameConfigurationType;
        
        // Set configuration from new table
        setConfiguration({
          id: typedConfigData.id,
          session_id: typedConfigData.session_id,
          game_number: typedConfigData.game_number,
          game_type: typedConfigData.game_type as GameType,
          created_at: typedConfigData.created_at,
          updated_at: typedConfigData.updated_at
        });
        
        // Fetch patterns for this configuration - use any type to bypass TypeScript checks temporarily
        const { data: patternsData, error: patternsError } = await (supabase
          .from('game_patterns' as any)
          .select('*')
          .eq('game_config_id', typedConfigData.id)
          .order('pattern_order', { ascending: true }) as any);

        if (patternsError) {
          console.error("Error fetching patterns:", patternsError);
        } else if (patternsData) {
          const typedPatterns: GamePattern[] = (patternsData as unknown as GamePatternType[]).map(p => ({
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
        }
      }

      // Fetch called items from the new table - use any type to bypass TypeScript checks temporarily
      const { data: calledItemsData, error: calledItemsError } = await (supabase
        .from('called_items' as any)
        .select('*')
        .eq('session_id', sessionId)
        .eq('game_number', currentGameNumber)
        .order('call_order', { ascending: true }) as any);

      if (calledItemsError) {
        console.error("Error fetching called items:", calledItemsError);
      } else if (calledItemsData) {
        const typedCalledItems: CalledItem[] = (calledItemsData as unknown as CalledItemType[]).map(c => ({
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
      
      // Insert the new called item - use any type to bypass TypeScript checks temporarily
      const { data, error } = await (supabase
        .from('called_items' as any)
        .insert({
          session_id: sessionId,
          game_number: configuration.game_number,
          item_value: newNumber,
          call_order: existingNumbers.length + 1
        })
        .select()
        .single() as any);
        
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
          } as any)
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
        } as any)
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
      
      const firstPatternId = nextPatternsData && nextPatternsData.length > 0 
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
    
    // Subscribe to called_items changes
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
          
          if (payload.new) {
            const newItem: CalledItem = {
              id: payload.new.id,
              session_id: payload.new.session_id,
              game_number: payload.new.game_number,
              item_value: payload.new.item_value,
              called_at: payload.new.called_at,
              call_order: payload.new.call_order
            };
            
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
          const updatedSession = payload.new;
          if (updatedSession && updatedSession.active_pattern_id !== activePattern) {
            setActivePattern(updatedSession.active_pattern_id);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(patternChannel);
    };
  }, [sessionId, fetchGameData, activePattern]);
  
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
