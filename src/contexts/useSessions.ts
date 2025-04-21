
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GameSession, GameType } from "@/types";

export function useSessions() {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [currentSession, setCurrentSessionState] = useState<GameSession | null>(null);

  // Fetches sessions from Supabase
  const fetchSessions = async () => {
    const { data } = await supabase.from("game_sessions").select("*");
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

  // Subscribes to session changes
  useEffect(() => {
    fetchSessions();

    const channel = supabase
      .channel("session-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_sessions",
        },
        (payload: any) => {
          fetchSessions();
          if (
            currentSession &&
            payload.new &&
            currentSession.id === payload.new.id
          ) {
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

  // Set current session by id
  const setCurrentSession = (sessionId: string | null) => {
    if (!sessionId) {
      setCurrentSessionState(null);
      return;
    }
    const session = sessions.find((s) => s.id === sessionId);
    setCurrentSessionState(session || null);
  };

  // Look up session by code
  const getSessionByCode = (code: string): GameSession | null => {
    return sessions.find((s) => s.accessCode === code) || null;
  };

  return {
    sessions,
    currentSession,
    setCurrentSession,
    setCurrentSessionState,
    getSessionByCode,
    fetchSessions,
  };
}
