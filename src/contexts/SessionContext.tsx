import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GameSession, GameType, Player } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { PostgrestSingleResponse } from '@supabase/supabase-js';

interface SessionContextType {
  sessions: GameSession[];
  currentSession: GameSession | null;
  players: Player[];
  joinSession: (playerCode: string) => Promise<{ player: Player | null }>;
  setCurrentSession: (sessionId: string | null) => void;
  getSessionByCode: (code: string) => GameSession | null;
  bulkAddPlayers: (sessionId: string, players: AdminTempPlayer[]) => Promise<{ success: boolean, message?: string }>;
  addPlayer: (sessionId: string, playerCode: string, nickname: string) => Promise<boolean>;
  fetchSessions: () => Promise<void>;
}
type AdminTempPlayer = {
  playerCode: string;
  nickname: string;
  email: string;
  tickets: number;
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [currentSession, setCurrentSessionState] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  const fetchSessions = async () => {
    const { data, error } = await supabase.from('game_sessions').select('*');
    if (data) {
      setSessions(
        data.map((d: any) => ({
          id: d.id,
          name: d.name,
          gameType: d.game_type as GameType,
          createdBy: d.created_by,
          accessCode: d.access_code,
          status: d.status,
          createdAt: d.created_at,
          sessionDate: d.session_date,
          numberOfGames: d.number_of_games,
        }))
      );
    }
  };

  useEffect(() => {
    fetchSessions();
    
    // Subscribe to realtime updates for game_sessions table
    const channel = supabase
      .channel('session-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions'
        },
        (payload) => {
          console.log('Session change received:', payload);
          fetchSessions();
          
          // If this is an update to our current session, update it directly
          if (currentSession && payload.new && payload.new.id === currentSession.id) {
            const updatedSession = {
              id: payload.new.id,
              name: payload.new.name,
              gameType: payload.new.game_type as GameType,
              createdBy: payload.new.created_by,
              accessCode: payload.new.access_code,
              status: payload.new.status,
              createdAt: payload.new.created_at,
              sessionDate: payload.new.session_date,
              numberOfGames: payload.new.number_of_games,
            };
            setCurrentSessionState(updatedSession);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSession]);

  const generateAccessCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const joinSession = async (playerCode: string): Promise<{ player: Player | null }> => {
    const { data, error } = await supabase.from('players').select('*').eq('player_code', playerCode).maybeSingle();
    if (error || !data) return { player: null };
    return {
      player: {
        id: data.id,
        sessionId: data.session_id,
        nickname: data.nickname,
        joinedAt: data.joined_at,
        playerCode: data.player_code,
        email: data.email,
        tickets: data.tickets
      }
    };
  };

  const setCurrentSession = (sessionId: string | null) => {
    if (!sessionId) {
      setCurrentSessionState(null);
      return;
    }
    const session = sessions.find(s => s.id === sessionId);
    setCurrentSessionState(session || null);
  };

  const getSessionByCode = (code: string): GameSession | null => {
    return sessions.find(s => s.accessCode === code) || null;
  };

  const addPlayer = async (sessionId: string, playerCode: string, nickname: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('players').insert({
        player_code: playerCode.toUpperCase(),
        nickname,
        session_id: sessionId,
        joined_at: new Date().toISOString(),
        tickets: 1
      });
      
      if (error) {
        console.error("Add player error:", error);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Add player exception:", err);
      return false;
    }
  };

  const bulkAddPlayers = async (
    sessionId: string,
    newPlayers: AdminTempPlayer[],
  ): Promise<{ success: boolean; message?: string }> => {
    const { error } = await supabase.from('players').insert(
      newPlayers.map(p => ({
        player_code: p.playerCode,
        nickname: p.nickname,
        email: p.email,
        tickets: p.tickets,
        session_id: sessionId,
        joined_at: new Date().toISOString()
      }))
    );

    if (error) {
      console.error("Bulk add error:", error);
      return { success: false, message: error.message };
    }
    
    return { success: true };
  };

  return (
    <SessionContext.Provider
      value={{
        sessions,
        currentSession,
        players,
        joinSession,
        setCurrentSession,
        getSessionByCode,
        bulkAddPlayers,
        addPlayer,
        fetchSessions
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
