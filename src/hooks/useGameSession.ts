
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

export function useGameSession(gameCode: string) {
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [currentWinPattern, setCurrentWinPattern] = useState<string | null>(null);
  const [gameType, setGameType] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSessionDetails() {
      if (!gameCode) return;
      
      setIsLoadingSession(true);
      setSessionError(null);
      
      try {
        logWithTimestamp(`Fetching session details for gameCode ${gameCode}`, 'info');
        
        // Get the session ID for the access code
        const { data: sessionData, error: sessionError } = await supabase
          .from('game_sessions')
          .select('id, name, caller_name, status, game_type, current_pattern, session_config')
          .eq('access_code', gameCode)
          .single();
        
        if (sessionError) {
          throw new Error(`Failed to find session: ${sessionError.message}`);
        }
        
        if (!sessionData) {
          throw new Error('Game session not found');
        }
        
        setSessionDetails({
          id: sessionData.id,
          name: sessionData.name,
          callerName: sessionData.caller_name,
          status: sessionData.status,
          gameType: sessionData.game_type
        });
        
        setCurrentWinPattern(sessionData.current_pattern);
        setGameType(sessionData.game_type);
        
        logWithTimestamp(`Session found: ${sessionData.name}, type: ${sessionData.game_type}`, 'info');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load game session';
        setSessionError(errorMessage);
        logWithTimestamp(`Error loading session: ${errorMessage}`, 'error');
      } finally {
        setIsLoadingSession(false);
      }
    }
    
    fetchSessionDetails();
  }, [gameCode]);
  
  return {
    sessionDetails,
    isLoadingSession,
    sessionError,
    currentWinPattern,
    gameType
  };
}
