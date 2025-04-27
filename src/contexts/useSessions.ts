
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameSession, GameConfig } from '@/types';
import { Json, parseGameConfigs } from '@/types/json';
import { normalizeGameConfig } from '@/utils/gameConfigHelper';

export function useSessions() {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [currentSession, setCurrentSessionState] = useState<GameSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedSessions = data.map((session): GameSession => {
        // Parse games_config to ensure proper format
        const gameConfigs = parseGameConfigs(session.games_config);
        
        return {
          id: session.id,
          name: session.name,
          gameType: session.game_type,
          createdBy: session.created_by,
          accessCode: session.access_code,
          status: session.status,
          createdAt: session.created_at,
          sessionDate: session.session_date,
          numberOfGames: session.number_of_games || 1,
          lifecycle_state: session.lifecycle_state,
          games_config: gameConfigs,
          current_game: session.current_game,
          active_pattern_id: session.active_pattern_id
        };
      });

      // Update sessions state
      setSessions(formattedSessions);

      // Update current session if one is set
      const currentSessionId = localStorage.getItem('currentSessionId');
      if (currentSessionId) {
        const session = formattedSessions.find(s => s.id === currentSessionId);
        if (session) {
          setCurrentSessionState(session);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setCurrentSession = useCallback((sessionId: string | null) => {
    if (sessionId) {
      localStorage.setItem('currentSessionId', sessionId);
      const session = sessions.find(s => s.id === sessionId);
      setCurrentSessionState(session || null);
    } else {
      localStorage.removeItem('currentSessionId');
      setCurrentSessionState(null);
    }
  }, [sessions]);

  const getSessionByCode = useCallback((code: string) => {
    return sessions.find(s => s.accessCode === code) || null;
  }, [sessions]);

  const updateSession = useCallback(async (sessionId: string, updates: Partial<GameSession>): Promise<boolean> => {
    if (!sessionId) return false;

    try {
      // Convert from our GameSession type to database format
      const dbUpdates: Record<string, any> = {};
      
      if ('name' in updates) dbUpdates.name = updates.name;
      if ('gameType' in updates) dbUpdates.game_type = updates.gameType;
      if ('accessCode' in updates) dbUpdates.access_code = updates.accessCode;
      if ('status' in updates) dbUpdates.status = updates.status;
      if ('sessionDate' in updates) dbUpdates.session_date = updates.sessionDate;
      if ('numberOfGames' in updates) dbUpdates.number_of_games = updates.numberOfGames;
      if ('lifecycle_state' in updates) dbUpdates.lifecycle_state = updates.lifecycle_state;
      if ('current_game' in updates) dbUpdates.current_game = updates.current_game;
      if ('active_pattern_id' in updates) dbUpdates.active_pattern_id = updates.active_pattern_id;
      
      // Handle games_config specially to ensure JSON compatibility
      if ('games_config' in updates && updates.games_config) {
        const normalizedConfigs = Array.isArray(updates.games_config)
          ? updates.games_config.map(config => normalizeGameConfig(config))
          : [normalizeGameConfig(updates.games_config)];
          
        dbUpdates.games_config = normalizedConfigs;
      }

      const { error } = await supabase
        .from('game_sessions')
        .update(dbUpdates)
        .eq('id', sessionId);

      if (error) {
        console.error("Error updating session:", error);
        return false;
      }

      // Update session in state
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...updates } : s));
      
      // Update current session if it's the one being updated
      if (currentSession?.id === sessionId) {
        setCurrentSessionState(prev => prev ? { ...prev, ...updates } : null);
      }

      return true;
    } catch (err) {
      console.error("Exception updating session:", err);
      return false;
    }
  }, [currentSession]);

  // Initial fetch on mount
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { 
    sessions, 
    currentSession, 
    setCurrentSession,
    getSessionByCode, 
    fetchSessions,
    updateSession,
    isLoading, 
    error 
  };
}
