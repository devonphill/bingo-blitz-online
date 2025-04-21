

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { GameSession, GameType, Player } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { usePlayers } from "./usePlayers";
import { useTickets } from "./useTickets";

// Define the context type
interface SessionContextType {
  sessions: GameSession[];
  currentSession: GameSession | null;
  setCurrentSession: (sessionId: string | null) => void;
  getSessionByCode: (code: string) => GameSession | null;
  fetchSessions: () => Promise<void>;
  // Player logic delegated to hook
  players: Player[];
  joinSession: ReturnType<typeof usePlayers>["joinSession"];
  addPlayer: ReturnType<typeof usePlayers>["addPlayer"];
  bulkAddPlayers: ReturnType<typeof usePlayers>["bulkAddPlayers"];
  // Ticket logic
  assignTicketsToPlayer: ReturnType<typeof useTickets>["assignTicketsToPlayer"];
  getPlayerAssignedTickets: ReturnType<typeof useTickets>["getPlayerAssignedTickets"];
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [currentSession, setCurrentSessionState] = useState<GameSession | null>(null);

  // Session fetch & realtime
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
  }, [currentSession]);

  // Tickets and Players hooks (delegated)
  const ticketHook = useTickets();
  const playerHook = usePlayers(
    sessions, fetchSessions, ticketHook.assignTicketsToPlayer
  );

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
        setCurrentSession,
        getSessionByCode,
        fetchSessions,
        // Player logic
        players: playerHook.players,
        joinSession: playerHook.joinSession,
        addPlayer: playerHook.addPlayer,
        bulkAddPlayers: playerHook.bulkAddPlayers,
        // Ticket logic
        assignTicketsToPlayer: ticketHook.assignTicketsToPlayer,
        getPlayerAssignedTickets: ticketHook.getPlayerAssignedTickets,
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

