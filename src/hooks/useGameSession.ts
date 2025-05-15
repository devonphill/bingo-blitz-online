
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { usePlayerContext } from '@/contexts/PlayerContext';

export function useGameSession(gameCode: string) {
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [currentWinPattern, setCurrentWinPattern] = useState<string | null>(null);
  const [gameType, setGameType] = useState<string | null>(null);
  const { player } = usePlayerContext();

  useEffect(() => {
    async function fetchSessionDetails() {
      if (!gameCode && (!player || !player.sessionId)) {
        logWithTimestamp("No game code or player session ID available", "error");
        return;
      }
      
      setIsLoadingSession(true);
      setSessionError(null);
      
      try {
        // First try to get sessionId from player context
        let sessionId = player?.sessionId;
        let playerId = player?.id;
        let playerName = player?.name;
        
        // If not available in context, get it from localStorage or fetch it
        if (!sessionId || !playerId) {
          const storedSessionId = localStorage.getItem('playerSessionId');
          const storedPlayerId = localStorage.getItem('playerId');
          const storedPlayerName = localStorage.getItem('playerName');
          
          if (storedSessionId && storedPlayerId) {
            sessionId = storedSessionId;
            playerId = storedPlayerId;
            playerName = storedPlayerName || 'Player';
            logWithTimestamp(`Using stored session ID: ${sessionId} and player ID: ${playerId}`, 'info');
          } else {
            logWithTimestamp(`Fetching player information for gameCode ${gameCode}`, 'info');
            
            // Fetch from Supabase if not in localStorage
            const { data: playerData, error: playerError } = await supabase
              .from('players')
              .select('id, nickname, session_id')
              .eq('player_code', gameCode)
              .single();
            
            if (playerError || !playerData) {
              throw new Error(`Failed to find player: ${playerError?.message || 'Player not found'}`);
            }
            
            sessionId = playerData.session_id;
            playerId = playerData.id;
            playerName = playerData.nickname || 'Player';
            
            logWithTimestamp(`Player found: ${playerName}, session ID: ${sessionId}`, 'info');
            
            // Save to localStorage for future use
            localStorage.setItem('playerSessionId', sessionId);
            localStorage.setItem('playerId', playerId);
            localStorage.setItem('playerName', playerName);
          }
        }
        
        if (!sessionId) {
          throw new Error('No session ID available to fetch session details');
        }
        
        // Step 2: Get the session using the session_id
        const { data: sessionData, error: sessionError } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
        
        if (sessionError) {
          throw new Error(`Failed to find session: ${sessionError.message}`);
        }
        
        if (!sessionData) {
          throw new Error('Game session not found');
        }
        
        // Get creator name from profiles
        const { data: creatorData } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', sessionData.created_by)
          .single();
          
        const callerName = creatorData?.username || 'Unknown Caller';
        
        // Get session progress for current pattern
        const { data: progressData } = await supabase
          .from('sessions_progress')
          .select('current_win_pattern, current_game_type, game_status')
          .eq('session_id', sessionData.id)
          .single();
        
        setSessionDetails({
          id: sessionData.id,
          name: sessionData.name,
          callerName: callerName,
          status: sessionData.status,
          gameType: sessionData.game_type,
          gameStatus: progressData?.game_status || 'pending'
        });
        
        setCurrentWinPattern(progressData?.current_win_pattern || null);
        setGameType(sessionData.game_type);
        
        logWithTimestamp(`Session found: ${sessionData.name}, type: ${sessionData.game_type}, status: ${progressData?.game_status || 'pending'}`, 'info');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load game session';
        setSessionError(errorMessage);
        logWithTimestamp(`Error loading session: ${errorMessage}`, 'error');
      } finally {
        setIsLoadingSession(false);
      }
    }
    
    fetchSessionDetails();
  }, [gameCode, player]);
  
  return {
    sessionDetails,
    isLoadingSession,
    sessionError,
    currentWinPattern,
    gameType,
    playerId: player?.id,
    playerName: player?.name
  };
}
