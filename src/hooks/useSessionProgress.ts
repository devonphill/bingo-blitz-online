
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { GameConfig } from '@/types';
import { parseJson } from '@/types/json';

export interface SessionProgress {
  id: string;
  session_id: string;
  current_game_number: number;
  max_game_number: number;
  current_game_type: string | null;
  current_win_pattern: string | null;
  called_numbers: number[];
  game_status: string | null;
  current_prize: string | null;
  current_prize_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionProgressUpdate {
  current_game_number?: number;
  current_win_pattern?: string;
  current_game_type?: string;
  called_numbers?: number[];
  game_status?: string;
  current_prize?: string;
  current_prize_description?: string;
}

/**
 * Hook to manage session progress data with real-time updates via database
 * @param sessionId The ID of the game session to track
 * @returns Object containing progress data, loading state, error state, and update function
 */
export function useSessionProgress(sessionId: string | undefined) {
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  
  // Added for better debugging
  const hookId = useRef(`useSessionProgress-${Math.random().toString(36).substring(2, 8)}`);
  const isInitialMount = useRef(true);
  const initialized = useRef(false);

  // Cleanup function for subscription
  const cleanupSubscription = useCallback(() => {
    if (subscription) {
      try {
        supabase.removeChannel(subscription);
        logWithTimestamp(`[${hookId.current}] Removed session progress subscription`, 'debug');
      } catch (err) {
        logWithTimestamp(`[${hookId.current}] Error removing subscription: ${err}`, 'error');
      }
      setSubscription(null);
    }
  }, [subscription]);

  // Function to fetch session progress data
  const fetchProgress = useCallback(async () => {
    if (!sessionId) {
      return Promise.reject(new Error("No session ID provided"));
    }

    try {
      setLoading(true);
      logWithTimestamp(`[${hookId.current}] Manually fetching session progress for: ${sessionId}`, 'info');
      
      const { data, error: fetchError } = await supabase
        .from('sessions_progress')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          logWithTimestamp(`[${hookId.current}] No session progress found in manual fetch`, 'info');
          return Promise.resolve(null);
        } else {
          throw new Error(`Error fetching session progress: ${fetchError.message}`);
        }
      }

      if (data) {
        logWithTimestamp(`[${hookId.current}] Manually loaded session progress successfully`, 'info');
        
        setProgress({
          id: data.id,
          session_id: data.session_id,
          current_game_number: data.current_game_number,
          max_game_number: data.max_game_number,
          current_game_type: data.current_game_type,
          current_win_pattern: data.current_win_pattern,
          called_numbers: data.called_numbers || [],
          game_status: data.game_status,
          current_prize: data.current_prize,
          current_prize_description: data.current_prize_description,
          created_at: data.created_at,
          updated_at: data.updated_at
        });
      }
      
      return Promise.resolve(data);
    } catch (err) {
      const errorMsg = `Error in manual fetch: ${(err as Error).message}`;
      logWithTimestamp(`[${hookId.current}] ${errorMsg}`, 'error');
      setError(errorMsg);
      return Promise.reject(err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, hookId]);

  // Setup subscription and initial data load
  useEffect(() => {
    // If no sessionId is provided, just set loading to false and return
    if (!sessionId) {
      setLoading(false);
      logWithTimestamp(`[${hookId.current}] No sessionId provided to useSessionProgress`, 'info');
      return;
    }

    // Set loading state
    setLoading(true);
    setError(null);
    
    logWithTimestamp(`[${hookId.current}] Setting up session progress for session ${sessionId}`, 'info');
    
    // Function to fetch the initial data
    const fetchSessionProgress = async () => {
      try {
        logWithTimestamp(`[${hookId.current}] Fetching session progress for: ${sessionId}`, 'info');
        
        const { data, error } = await supabase
          .from('sessions_progress')
          .select('*')
          .eq('session_id', sessionId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No data found, this might be expected in some cases
            logWithTimestamp(`[${hookId.current}] No session progress found for session ${sessionId}, will create one if needed`, 'info');
          } else {
            throw new Error(`Error fetching session progress: ${error.message}`);
          }
        }

        if (data) {
          logWithTimestamp(`[${hookId.current}] Loaded session progress successfully`, 'info');
          logWithTimestamp(`[${hookId.current}] Current win pattern from database: ${data.current_win_pattern}`, 'info');
          
          setProgress({
            id: data.id,
            session_id: data.session_id,
            current_game_number: data.current_game_number,
            max_game_number: data.max_game_number,
            current_game_type: data.current_game_type,
            current_win_pattern: data.current_win_pattern,
            called_numbers: data.called_numbers || [],
            game_status: data.game_status,
            current_prize: data.current_prize,
            current_prize_description: data.current_prize_description,
            created_at: data.created_at,
            updated_at: data.updated_at
          });
          
          // Log the current win pattern and game status
          logWithTimestamp(`[${hookId.current}] Current win pattern: ${data.current_win_pattern}`, 'info');
          logWithTimestamp(`[${hookId.current}] Game status: ${data.game_status}`, 'info');
        } else {
          // Check if we need to create a new sessions_progress entry
          logWithTimestamp(`[${hookId.current}] No session progress found, checking if we need to create one`, 'info');
          
          // Get session information first
          const { data: sessionData } = await supabase
            .from('game_sessions')
            .select('number_of_games, game_type, games_config')
            .eq('id', sessionId)
            .single();
            
          if (sessionData) {
            logWithTimestamp(`[${hookId.current}] Creating new session progress for session ${sessionId}`, 'info');
            
            // Try to determine initial win pattern from games_config
            let initialWinPattern = 'oneLine'; // Default
            
            try {
              if (sessionData.games_config && Array.isArray(sessionData.games_config) && sessionData.games_config.length > 0) {
                // Fixed: Properly type and access the games_config data
                const firstGameConfig = sessionData.games_config[0] as unknown as GameConfig;
                
                if (firstGameConfig && typeof firstGameConfig === 'object' && firstGameConfig.patterns) {
                  // Find first active pattern
                  for (const [patternId, pattern] of Object.entries(firstGameConfig.patterns)) {
                    if (pattern && typeof pattern === 'object' && pattern.active === true) {
                      initialWinPattern = patternId;
                      break;
                    }
                  }
                }
              }
            } catch (configError) {
              logWithTimestamp(`[${hookId.current}] Error reading games_config: ${configError}`, 'error');
              // Continue with default win pattern
            }

            logWithTimestamp(`[${hookId.current}] Determined initial win pattern: ${initialWinPattern}`, 'info');
            
            // Create a new session progress entry
            const { data: newProgress, error: createError } = await supabase
              .from('sessions_progress')
              .insert({
                session_id: sessionId,
                current_game_number: 1,
                max_game_number: sessionData.number_of_games || 1,
                current_game_type: sessionData.game_type,
                current_win_pattern: initialWinPattern, // Set initial win pattern
                called_numbers: [],
                game_status: 'pending'
              })
              .select('*')
              .single();
              
            if (createError) {
              throw new Error(`Failed to create session progress: ${createError.message}`);
            }
            
            if (newProgress) {
              logWithTimestamp(`[${hookId.current}] New session progress created successfully`, 'info');
              logWithTimestamp(`[${hookId.current}] Initial win pattern: ${initialWinPattern}`, 'info');
              setProgress({
                id: newProgress.id,
                session_id: newProgress.session_id,
                current_game_number: newProgress.current_game_number,
                max_game_number: newProgress.max_game_number,
                current_game_type: newProgress.current_game_type,
                current_win_pattern: newProgress.current_win_pattern,
                called_numbers: newProgress.called_numbers || [],
                game_status: newProgress.game_status,
                current_prize: newProgress.current_prize,
                current_prize_description: newProgress.current_prize_description,
                created_at: newProgress.created_at,
                updated_at: newProgress.updated_at
              });
            }
          }
        }
        
        // After loading initial data, set up the subscription
        setupSubscription();
        
      } catch (err) {
        logWithTimestamp(`[${hookId.current}] Error in useSessionProgress: ${(err as Error).message}`, 'error');
        setError((err as Error).message);
        setLoading(false);
      }
    };
    
    // Function to set up the subscription
    const setupSubscription = () => {
      try {
        logWithTimestamp(`[${hookId.current}] Setting up session progress subscription for session ${sessionId}`, 'info');
        
        const channel = supabase
          .channel(`session_progress_${sessionId}`)
          .on('postgres_changes', 
            { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'sessions_progress',
              filter: `session_id=eq.${sessionId}`
            }, 
            (payload) => {
              logWithTimestamp(`[${hookId.current}] Received session progress update`, 'debug');
              
              if (payload.new) {
                const newData = payload.new as any;
                
                // Log important updates for debugging
                if (newData.current_win_pattern !== progress?.current_win_pattern) {
                  logWithTimestamp(`[${hookId.current}] Win pattern changed: ${progress?.current_win_pattern} -> ${newData.current_win_pattern}`, 'info');
                }
                
                if (newData.game_status !== progress?.game_status) {
                  logWithTimestamp(`[${hookId.current}] Game status changed: ${progress?.game_status} -> ${newData.game_status}`, 'info');
                }
                
                if (newData.current_game_number !== progress?.current_game_number) {
                  logWithTimestamp(`[${hookId.current}] Game number changed: ${progress?.current_game_number} -> ${newData.current_game_number}`, 'info');
                }
                
                setProgress({
                  id: newData.id,
                  session_id: newData.session_id,
                  current_game_number: newData.current_game_number,
                  max_game_number: newData.max_game_number,
                  current_game_type: newData.current_game_type,
                  current_win_pattern: newData.current_win_pattern,
                  called_numbers: newData.called_numbers || [],
                  game_status: newData.game_status,
                  current_prize: newData.current_prize,
                  current_prize_description: newData.current_prize_description,
                  created_at: newData.created_at,
                  updated_at: newData.updated_at
                });
              }
            }
          )
          .subscribe((status) => {
            logWithTimestamp(`[${hookId.current}] Session progress subscription status: ${status}`, 'debug');
            
            if (status === 'SUBSCRIBED') {
              setLoading(false);
            } else if (status === 'CHANNEL_ERROR') {
              logWithTimestamp(`[${hookId.current}] Error with session progress subscription`, 'error');
              setError('Error connecting to real-time updates');
              setLoading(false);
            }
          });
          
        setSubscription(channel);
        
      } catch (err) {
        logWithTimestamp(`[${hookId.current}] Error setting up subscription: ${(err as Error).message}`, 'error');
        setError(`Error setting up real-time updates: ${(err as Error).message}`);
        setLoading(false);
      }
    };
    
    // Only re-fetch data if needed
    if (!progress || progress.session_id !== sessionId) {
      // Load initial data
      fetchSessionProgress();
    } else {
      setLoading(false);
    }
    
    // Clean up subscription when unmounting or changing sessionId
    return () => {
      cleanupSubscription();
    };
    
  }, [sessionId, cleanupSubscription, progress]);

  // Function to update session progress
  const updateProgress = useCallback(async (updates: SessionProgressUpdate): Promise<boolean> => {
    if (!sessionId) {
      logWithTimestamp(`[${hookId.current}] Cannot update session progress - missing sessionId`, 'error');
      return false;
    }
    
    try {
      logWithTimestamp(`[${hookId.current}] Updating session progress with: ${JSON.stringify(updates)}`, 'info');
      
      const { error } = await supabase
        .from('sessions_progress')
        .update(updates)
        .eq('session_id', sessionId);
        
      if (error) {
        logWithTimestamp(`[${hookId.current}] Error updating session progress: ${error.message}`, 'error');
        return false;
      }
      
      logWithTimestamp(`[${hookId.current}] Session progress updated successfully`, 'info');
      return true;
    } catch (err) {
      logWithTimestamp(`[${hookId.current}] Exception updating session progress: ${(err as Error).message}`, 'error');
      return false;
    }
  }, [sessionId, hookId]);

  return { 
    progress, 
    loading, 
    error,
    updateProgress,
    fetchProgress // Add the new method to the returned object
  };
}
