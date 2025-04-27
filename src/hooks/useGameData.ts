import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameConfiguration, GamePattern, CalledItem, GameType } from '@/types';
import { Json, isOfType, GameConfigurationType, GamePatternType, CalledItemType, SessionWithActivePattern, CurrentGameStateType } from '@/types/json';

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

      // Fetch game configuration from session data since we don't have the game_configurations table
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .select('game_type, current_game_state, current_game')
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
      
      // Get active pattern from session progress
      const { data: currentProgress, error: currentProgressError } = await supabase
        .from('sessions_progress')
        .select('current_win_pattern')
        .eq('session_id', sessionId)
        .single();
      
      if (!currentProgressError && currentProgress && currentProgress.current_win_pattern) {
        setActivePattern(currentProgress.current_win_pattern);
      } else if (sessionData?.current_game_state && 
                typeof sessionData.current_game_state === 'object') {
        // Type-safe handling of current_game_state
        const gameState = sessionData.current_game_state as any;
        
        if (gameState && 'activePatternIds' in gameState && Array.isArray(gameState.activePatternIds)) {
          const activePatterns = gameState.activePatternIds;
          if (activePatterns && activePatterns.length > 0) {
            setActivePattern(activePatterns[0]);
          }
        }
      }
      
      // Extract patterns from the session's current_game_state
      if (sessionData?.current_game_state && 
          typeof sessionData.current_game_state === 'object') {
        
        // Type-safe handling using explicit checks
        const gameState = sessionData.current_game_state as any;
        
        if (gameState && 'activePatternIds' in gameState && 'prizes' in gameState) {
          const activePatterns = Array.isArray(gameState.activePatternIds) ? gameState.activePatternIds : [];
          const prizes = typeof gameState.prizes === 'object' ? gameState.prizes : {};
          
          const extractedPatterns: GamePattern[] = activePatterns.map((patternId: string, index: number) => {
            const prizeDetails = prizes[patternId] || {};
            
            return {
              id: `legacy-${patternId}`,
              game_config_id: 'legacy',
              pattern_id: patternId,
              pattern_order: index,
              prize_amount: prizeDetails.amount,
              prize_description: prizeDetails.description,
              is_non_cash: !!prizeDetails.isNonCash,
              created_at: new Date().toISOString()
            };
          });
          
          setPatterns(extractedPatterns);
        }
      }

      // Fetch called items from the legacy game state
      if (sessionData?.current_game_state && 
          typeof sessionData.current_game_state === 'object') {
          
        const gameState = sessionData.current_game_state as any;
        
        if (gameState && 'calledItems' in gameState && Array.isArray(gameState.calledItems)) {
          const existingCalls = gameState.calledItems || [];
          
          const legacyCalledItems: CalledItem[] = existingCalls.map((item: any, index: number) => {
            if (typeof item === 'number') {
              // Simple number array
              return {
                id: `legacy-${index}`,
                session_id: sessionId,
                game_number: currentGameNumber || 1,
                item_value: item,
                called_at: new Date().toISOString(),
                call_order: index + 1
              };
            } else if (typeof item === 'object' && item !== null) {
              // Object array with more details
              return {
                id: item.id || `legacy-${index}`,
                session_id: sessionId,
                game_number: currentGameNumber || 1,
                item_value: item.value || item.number || 0,
                called_at: item.called_at || new Date().toISOString(),
                call_order: index + 1
              };
            }
            
            // Fallback
            return {
              id: `legacy-${index}`,
              session_id: sessionId,
              game_number: currentGameNumber || 1,
              item_value: 0,
              called_at: new Date().toISOString(),
              call_order: index + 1
            };
          });
          
          setCalledItems(legacyCalledItems);
          
          if (legacyCalledItems.length > 0) {
            setLastCalledItem(legacyCalledItems[legacyCalledItems.length - 1].item_value);
          }
          
          if ('lastCalledItem' in gameState && gameState.lastCalledItem !== null) {
            if (typeof gameState.lastCalledItem === 'number') {
              setLastCalledItem(gameState.lastCalledItem);
            } else if (typeof gameState.lastCalledItem === 'object' && gameState.lastCalledItem !== null) {
              setLastCalledItem(gameState.lastCalledItem.value || gameState.lastCalledItem.number || null);
            }
          }
        }
      }
      
      // Fetch called numbers from called_numbers table as a fallback
      const { data: calledNumbersData, error: calledNumbersError } = await supabase
        .from('called_numbers')
        .select('*')
        .eq('session_id', sessionId)
        .order('called_at', { ascending: true });
        
      if (!calledNumbersError && calledNumbersData && calledNumbersData.length > 0 && calledItems.length === 0) {
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
  }, [sessionId, gameNumber, calledItems.length]);

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
        // Legacy fallback - update the current_game_state JSON
        const { data: sessionData } = await supabase
          .from('game_sessions')
          .select('current_game_state')
          .eq('id', sessionId)
          .single();
          
        let currentGameState = sessionData?.current_game_state || {};
        if (typeof currentGameState === 'object') {
          // Safe type casting for state update
          const typedGameState = currentGameState as Record<string, any>;
          
          const updatedGameState = {
            ...typedGameState,
            calledItems: [...(Array.isArray(typedGameState.calledItems) ? typedGameState.calledItems : []), newNumber],
            lastCalledItem: newNumber
          };
          
          const { error: updateError } = await supabase
            .from('game_sessions')
            .update({ current_game_state: updatedGameState as Json })
            .eq('id', sessionId);
            
          if (updateError) {
            console.error("Error in legacy call number update:", updateError);
            return null;
          }
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
      
      // Update the active pattern in the sessions_progress table
      const { error: progressError } = await supabase
        .from('sessions_progress')
        .update({
          current_win_pattern: nextPattern.pattern_id
        })
        .eq('session_id', sessionId);
        
      if (progressError) {
        console.error("Error updating session progress:", progressError);
        return false;
      }
      
      // Update session with active pattern
      const updateData: Partial<SessionWithActivePattern> = {
        active_pattern_id: nextPattern.pattern_id
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
      
      // Get the first pattern for the next game from the session configuration
      const { data: sessionData } = await supabase
        .from('game_sessions')
        .select('games_config')
        .eq('id', sessionId)
        .single();
        
      let firstPatternId = 'oneLine'; // Default pattern
      
      if (sessionData?.games_config) {
        const gamesConfig = Array.isArray(sessionData.games_config) ? sessionData.games_config : [];
        const nextGameConfig = gamesConfig.find((config: any) => config?.gameNumber === nextGameNumber);
        
        if (nextGameConfig && 'selectedPatterns' in nextGameConfig && 
            Array.isArray(nextGameConfig.selectedPatterns) && 
            nextGameConfig.selectedPatterns.length > 0) {
          firstPatternId = nextGameConfig.selectedPatterns[0];
        }
      }
      
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
  }, [sessionId, configuration]);

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
  }, [sessionId, fetchGameData, calledItems.length, configuration?.game_number]);
  
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
