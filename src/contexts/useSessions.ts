
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameSession } from '@/types';
import { convertFromLegacyConfig } from '@/utils/callerSessionHelper';

export function useSessions() {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sessions:', error);
        return;
      }

      if (data) {
        // Convert raw data to GameSession objects
        const sessionObjects: GameSession[] = data.map(session => ({
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
          games_config: session.games_config ? 
            (Array.isArray(session.games_config) ? 
              session.games_config.map(convertFromLegacyConfig) : 
              [convertFromLegacyConfig(session.games_config)]) : 
            []
        }));
        setSessions(sessionObjects);
      }
    } catch (err) {
      console.error('Exception in fetchSessions:', err);
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

  return {
    sessions,
    currentSession,
    setCurrentSession: setSessionById,
    getSessionByCode,
    fetchSessions
  };
}
