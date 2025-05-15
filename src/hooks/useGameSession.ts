
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

export function useGameSession(gameCode: string) {
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [currentWinPattern, setCurrentWinPattern] = useState<string | null>(null);
  const [gameType, setGameType] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSessionDetails() {
      if (!gameCode) return;
      
      setIsLoadingSession(true);
      setSessionError(null);
      
      try {
        logWithTimestamp(`Fetching player information for gameCode ${gameCode}`, 'info');
        
        // Step 1: Get the player by player_code
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('id, nickname, player_code, session_id')
          .eq('player_code', gameCode)
          .single();
        
        if (playerError) {
          throw new Error(`Failed to find player: ${playerError.message}`);
        }
        
        if (!playerData) {
          throw new Error('Player not found with this code');
        }
        
        logWithTimestamp(`Player found: ${playerData.nickname || playerData.player_code}, session ID: ${playerData.session_id}`, 'info');
        setPlayerId(playerData.id);
        setPlayerName(playerData.nickname || playerData.player_code);
        
        if (!playerData.session_id) {
          throw new Error('Player has no associated game session');
        }
        
        // Save player data to localStorage for persistence
        localStorage.setItem('playerCode', gameCode);
        localStorage.setItem('playerName', playerData.nickname || playerData.player_code);
        localStorage.setItem('playerId', playerData.id);
        localStorage.setItem('playerSessionId', playerData.session_id);
        
        // Step 2: Get the session using the player's session_id
        const { data: sessionData, error: sessionError } = await supabase
          .from('game_sessions')
          .select('*')  // Select all columns to avoid missing column errors
          .eq('id', playerData.session_id)
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
  }, [gameCode]);
  
  return {
    sessionDetails,
    isLoadingSession,
    sessionError,
    currentWinPattern,
    gameType,
    playerId,
    playerName
  };
}
