
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { GameSession, GameType } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { usePlayers } from "./usePlayers";
import { useTickets } from "./useTickets";

// This context will only provide a bridge and synchronize data, delegating logic
// to the player and ticket hooks.
interface SessionContextType {
  sessions: GameSession[];
  currentSession: GameSession | null;
  players: ReturnType<typeof usePlayers>["players"];
  setCurrentSession: (sessionId: string | null) => void;
  getSessionByCode: (code: string) => GameSession | null;
  bulkAddPlayers: ReturnType<typeof usePlayers>["bulkAddPlayers"];
  addPlayer: ReturnType<typeof usePlayers>["addPlayer"];
  fetchSessions: () => Promise<void>;
  joinSession: ReturnType<typeof usePlayers>["joinSession"];
  assignTicketsToPlayer: ReturnType<typeof useTickets>["assignTicketsToPlayer"];
  getPlayerAssignedTickets: ReturnType<typeof useTickets>["getPlayerAssignedTickets"];
}

// Provide a Source of Truth for session data and combine player/ticket logic
const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [currentSession, setCurrentSessionState] = useState<GameSession | null>(null);

  const { assignTicketsToPlayer, getPlayerAssignedTickets } = useTickets();

  // Pass the current assignTicketsToPlayer for use in the player hook
  const { players, setPlayers, joinSession, addPlayer, bulkAddPlayers } = usePlayers(
    sessions,
    fetchSessions,
    assignTicketsToPlayer
  );

  // Session fetching logic stays here
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

    const channel = supabase
      .channel('session-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions'
        },
        (payload: {
          eventType: string;
          new: Record<string, any> | null;
          old: Record<string, any> | null;
        }) => {
          console.log('Session change received:', payload);
          fetchSessions();

          if (currentSession && payload.new && currentSession.id === payload.new.id) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession]);

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
        fetchSessions,
        assignTicketsToPlayer,
        getPlayerAssignedTickets
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
