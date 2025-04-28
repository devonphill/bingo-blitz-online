
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameSession, GameConfig } from '@/types';
import { convertFromLegacyConfig } from '@/utils/callerSessionHelper';
import { jsonToGameConfigs, gameConfigsToJson } from '@/utils/jsonUtils';

export function useSessions() {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sessions:', error);
        setError(error.message);
        return;
      }

      if (data) {
        // Convert raw data to GameSession objects
        const sessionObjects: GameSession[] = data.map(session => {
          // Process games_config to ensure it's in the correct format
          let processedGamesConfig: GameConfig[] = [];
          
          if (session.games_config) {
            console.log(`Session ${session.id} - Raw games_config:`, session.games_config);
            
            // Use jsonToGameConfigs to safely convert the JSON data
            // This explicitly handles the active flag to ensure it's only true if explicitly set to true
            processedGamesConfig = jsonToGameConfigs(session.games_config);
            console.log(`Session ${session.id} - Processed games_config:`, processedGamesConfig);
          }
          
          return {
            id: session.id,
            name: session.name,
            gameType: session.game_type as any,
            createdBy: session.created_by,
            accessCode: session.access_code,
            status: session.status as any,
            createdAt: session.created_at,
            sessionDate: session.session_date,
            numberOfGames: session.number_of_games,
            current_game: session.current_game,
            lifecycle_state: session.lifecycle_state as any,
            games_config: processedGamesConfig
          };
        });
        
        setSessions(sessionObjects);
      }
    } catch (err) {
      console.error('Exception in fetchSessions:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setSessionById = useCallback((sessionId: string | null) => {
    if (!sessionId) {
      setCurrentSession(null);
      return;
    }

    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSession(session);
    } else {
      console.warn(`Session with ID ${sessionId} not found.`);
    }
  }, [sessions]);

  const getSessionByCode = useCallback((code: string): GameSession | null => {
    return sessions.find(s => s.accessCode === code) || null;
  }, [sessions]);

  const updateSession = useCallback(async (sessionId: string, updates: Partial<GameSession>): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Convert the updates to database column names
      const dbUpdates: Record<string, any> = {};
      if ('gameType' in updates) dbUpdates.game_type = updates.gameType;
      
      if ('games_config' in updates && updates.games_config) {
        console.log("games_config updates to save:", updates.games_config);
        
        // Convert the GameConfig[] to JSON for storage
        // This ensures patterns are only active if explicitly true
        dbUpdates.games_config = gameConfigsToJson(updates.games_config);
        
        console.log("Converted games_config for database:", dbUpdates.games_config);
      }
      
      if ('status' in updates) dbUpdates.status = updates.status;
      if ('lifecycle_state' in updates) dbUpdates.lifecycle_state = updates.lifecycle_state;
      if ('current_game' in updates) dbUpdates.current_game = updates.current_game;
      if ('numberOfGames' in updates) dbUpdates.number_of_games = updates.numberOfGames;
      if ('name' in updates) dbUpdates.name = updates.name;

      const { error } = await supabase
        .from('game_sessions')
        .update(dbUpdates)
        .eq('id', sessionId);

      if (error) {
        console.error('Error updating session:', error);
        setError(error.message);
        return false;
      }

      // Update local state
      setSessions(prev => 
        prev.map(session => 
          session.id === sessionId ? { ...session, ...updates } : session
        )
      );

      // Update current session if it's the one being updated
      if (currentSession?.id === sessionId) {
        setCurrentSession(prevSession => 
          prevSession ? { ...prevSession, ...updates } : null
        );
      }

      return true;
    } catch (err) {
      console.error('Exception in updateSession:', err);
      setError('An unexpected error occurred while updating the session');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentSession]);

  return {
    sessions,
    currentSession,
    setCurrentSession: setSessionById,
    getSessionByCode,
    fetchSessions,
    updateSession,
    isLoading,
    error
  };
}
