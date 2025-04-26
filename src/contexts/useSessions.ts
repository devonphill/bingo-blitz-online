
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GameSession, GameType, CurrentGameState } from "@/types";

// Define a type for the Json value since it's missing from the supabase-js export
type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// Helper function to initialize game state
const initializeGameState = (gameType: GameType, gameNumber: number): CurrentGameState => ({
  gameNumber,
  gameType,
  activePatternIds: [],
  calledItems: [],
  lastCalledItem: null,
  status: 'pending',
  prizes: {},
});

export const useSessions = () => {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [currentSession, setCurrentSessionState] = useState<GameSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetches all sessions from Supabase
  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Select all columns, including the new one
      const { data, error: fetchError } = await supabase.from("game_sessions").select("*");

      if (fetchError) {
        console.error("Error fetching sessions:", fetchError);
        setError("Failed to fetch sessions.");
        setSessions([]); // Clear sessions on error
      } else if (data) {
        // Map the data, ensuring current_game_state and lifecycle_state are handled
        const mappedSessions = data.map((d: any): GameSession => ({
          id: d.id,
          name: d.name,
          gameType: d.game_type as GameType, // Overall session type
          createdBy: d.created_by,
          accessCode: d.access_code,
          status: d.status, // Overall session status
          createdAt: d.created_at,
          sessionDate: d.session_date,
          numberOfGames: d.number_of_games, // Consider how this relates to currentGameNumber
          // Handle the new JSONB column, provide default if null/undefined
          current_game_state: d.current_game_state
            ? (d.current_game_state as CurrentGameState)
            : initializeGameState(d.game_type as GameType, 1),
          // Include the lifecycle_state property, default to 'setup'
          lifecycle_state: d.lifecycle_state || 'setup',
        }));
        
        console.log("Mapped sessions:", mappedSessions);
        setSessions(mappedSessions);

        // If a current session is set, update its state from the newly fetched data
        if (currentSession) {
          const updatedCurrent = mappedSessions.find(s => s.id === currentSession.id);
          if (updatedCurrent) {
            setCurrentSessionState(updatedCurrent);
          }
        }

      } else {
        setSessions([]);
      }
    } catch (err) {
      console.error("Exception fetching sessions:", err);
      setError("An unexpected error occurred while fetching sessions.");
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentSession]); // Dependency on currentSession to refresh its state

  // Subscribes to session changes (including current_game_state updates)
  useEffect(() => {
    // Initial fetch
    fetchSessions();

    const channel = supabase
      .channel("session-changes")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen for INSERT, UPDATE, DELETE
          schema: "public",
          table: "game_sessions",
        },
        (payload: any) => {
          console.log("Session change detected:", payload);

          // Refetch all sessions to update the list
          // Alternatively, smartly update/insert/delete based on payload
          fetchSessions();

          // If the change affects the currently viewed session, update it directly
          // Note: fetchSessions() above might already handle this if currentSession dependency works as expected.
          // Explicit update here ensures reactivity if fetchSessions updates are batched/delayed.
          if (currentSession && payload.new && currentSession.id === payload.new.id) {
            const updatedSessionData = payload.new;
            const updatedCurrentSession: GameSession = {
              id: updatedSessionData.id,
              name: updatedSessionData.name,
              gameType: updatedSessionData.game_type as GameType,
              createdBy: updatedSessionData.created_by,
              accessCode: updatedSessionData.access_code,
              status: updatedSessionData.status,
              createdAt: updatedSessionData.created_at,
              sessionDate: updatedSessionData.session_date,
              numberOfGames: updatedSessionData.number_of_games,
              current_game_state: updatedSessionData.current_game_state
                ? (updatedSessionData.current_game_state as CurrentGameState)
                : initializeGameState(updatedSessionData.game_type as GameType, 1),
            };
            console.log("Updating current session state from payload:", updatedCurrentSession);
            setCurrentSessionState(updatedCurrentSession);
          } else if (currentSession && payload.old && payload.old.id === currentSession.id && payload.eventType === 'DELETE') {
            // Handle case where the current session is deleted
            setCurrentSessionState(null);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to session changes');
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Session subscription error:', status, err);
          setError(`Session subscription failed: ${status}`);
        }
      });

    // Cleanup function
    return () => {
      console.log("Removing channel subscription for session-changes");
      supabase.removeChannel(channel).catch(err => console.error("Error removing channel:", err));
    };
    // Fetch sessions depends on currentSession now to ensure it updates correctly
  }, [fetchSessions, currentSession]);

  // Set current session by id
  const setCurrentSession = useCallback((sessionId: string | null) => {
    if (!sessionId) {
      setCurrentSessionState(null);
      return;
    }
    // Find the session from the already fetched list
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setCurrentSessionState(session);
    } else {
      console.warn(`Session with ID ${sessionId} not found in local state.`);
    }
  }, [sessions]);

  // Function to update the current game state within a session
  const updateCurrentGameState = async (newGameState: Partial<CurrentGameState>): Promise<boolean> => {
    if (!currentSession) return false;

    try {
      // Make sure all required properties are included in the merged game state
      const currentGameState = currentSession.current_game_state || initializeGameState(
        currentSession.gameType, 
        1
      );
      
      // Create a complete game state with all required fields
      const updatedGameState: CurrentGameState = {
        gameNumber: newGameState.gameNumber !== undefined ? newGameState.gameNumber : currentGameState.gameNumber,
        gameType: newGameState.gameType !== undefined ? newGameState.gameType : currentGameState.gameType,
        activePatternIds: newGameState.activePatternIds !== undefined ? newGameState.activePatternIds : currentGameState.activePatternIds,
        calledItems: newGameState.calledItems !== undefined ? newGameState.calledItems : currentGameState.calledItems,
        lastCalledItem: newGameState.lastCalledItem !== undefined ? newGameState.lastCalledItem : currentGameState.lastCalledItem,
        status: newGameState.status !== undefined ? newGameState.status : currentGameState.status,
        prizes: newGameState.prizes !== undefined ? newGameState.prizes : currentGameState.prizes
      };

      const { error } = await supabase
        .from('game_sessions')
        .update({ 
          current_game_state: updatedGameState as unknown as Json 
        })
        .eq('id', currentSession.id);

      if (error) {
        console.error('Error updating game state:', error);
        return false;
      }

      // Update the local state with the properly typed game state
      // Use a different approach to update the state to avoid TypeScript error
      const updatedSession = {
        ...currentSession,
        current_game_state: updatedGameState
      };
      setCurrentSessionState(updatedSession);

      return true;
    } catch (err) {
      console.error('Exception updating game state:', err);
      return false;
    }
  };

  // Look up session by access code
  const getSessionByCode = useCallback((code: string): GameSession | null => {
    return sessions.find((s) => s.accessCode === code) || null;
  }, [sessions]);

  return {
    sessions,
    currentSession,
    setCurrentSession,
    getSessionByCode,
    fetchSessions,
    updateCurrentGameState,
    isLoading,
    error,
  };
};
