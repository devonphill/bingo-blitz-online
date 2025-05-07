import React, { createContext, useState, useContext, ReactNode } from 'react';
import { useSessions } from './useSessions';
import { usePlayers } from './usePlayers';
import { useTickets } from './useTickets';
import { useGameManager } from '@/contexts/GameManager'; // Import GameManager
import type { GameSession, Player, TempPlayer } from '@/types';
import { AdminTempPlayer } from './usePlayers';
import { logWithTimestamp } from '@/utils/logUtils';

interface SessionContextType {
  session: GameSession | null;
  sessions: GameSession[];
  currentSession: GameSession | null;
  setCurrentSession: (sessionId: string | null) => void;
  getSessionByCode: (code: string) => GameSession | null;
  fetchSessions: () => Promise<boolean>;
  updateSession: (sessionId: string, updates: Partial<GameSession>) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  players?: Player[];
  joinSession: (playerCode: string) => Promise<{ success: boolean; playerCode?: string; playerId?: string; error?: string }>;
  addPlayer: (sessionId: string, player: TempPlayer) => Promise<string | null>;
  bulkAddPlayers: (sessionId: string, newPlayers: AdminTempPlayer[]) => Promise<{ success: boolean; message?: string; count?: number; error?: string }>;
  fetchPlayers?: (sessionId: string) => Promise<void>;
  assignTicketsToPlayer?: (playerId: string, sessionId: string, ticketCount: number) => Promise<any>;
  getPlayerAssignedTickets?: (playerId: string, sessionId: string) => Promise<any>;
  transitionToState: (newState: string) => void;
  createSession: (gameTypeId: string) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const { 
    sessions, 
    currentSession, 
    setCurrentSession: setSessionById,
    getSessionByCode,
    fetchSessions,
    updateSession,
    isLoading,
    error 
  } = useSessions();

  const ticketsHook = useTickets();
  const playersHook = usePlayers(
    sessions,
    fetchSessions as () => Promise<any>,
    ticketsHook.assignTicketsToPlayer
  );

  const { currentGameType } = useGameManager(); // Access current game type from GameManager

  const [session, setSession] = useState({
    id: null,
    gameType: null,
    players: [],
    state: "setup", // setup, lobby, live, completed
  });

  const createSession = (gameTypeId: string) => {
    const gameType = currentGameType || { id: gameTypeId, name: "Unknown Game" };
    setSession({
      id: generateSessionId(),
      gameType,
      players: [],
      state: "setup",
    });
    logWithTimestamp(`Session created with game type: ${gameType.name}`, 'info');
  };

  const addPlayer = (player: TempPlayer) => {
    setSession((prev) => ({
      ...prev,
      players: [...prev.players, player],
    }));
    logWithTimestamp(`Player added: ${JSON.stringify(player)}`, 'info');
  };

  const transitionToState = (newState: string) => {
    const validStates = ["setup", "lobby", "live", "completed"];
    if (validStates.includes(newState)) {
      setSession((prev) => ({ ...prev, state: newState }));
      logWithTimestamp(`Session transitioned to state: ${newState}`, 'info');
    } else {
      console.error(`Invalid session state: ${newState}`);
    }
  };

  const contextValue: SessionContextType = {
    session,
    sessions,
    currentSession,
    setCurrentSession: (sessionId: string | null) => {
      if (currentSession?.id === sessionId) {
        logWithTimestamp("Session is already selected, skipping update", 'debug');
        return;
      }
      logWithTimestamp(`Setting current session ID: ${sessionId || 'null'}`, 'info');
      setSessionById(sessionId);
    },
    getSessionByCode,
    fetchSessions,
    updateSession,
    isLoading,
    error,
    players: playersHook.players,
    joinSession: async (playerCode: string) => {
      try {
        logWithTimestamp("Provider: Joining session with player code: " + playerCode, 'info');
        const result = await playersHook.joinSession(playerCode);
        logWithTimestamp(`Provider: Join session result: ${JSON.stringify(result)}`, 'info');
        return result;
      } catch (error) {
        logWithTimestamp(`Provider: Error joining session: ${(error as Error).message}`, 'error');
        return { 
          success: false, 
          error: (error as Error).message 
        };
      }
    },
    addPlayer: playersHook.addPlayer,
    bulkAddPlayers: playersHook.bulkAddPlayers,
    fetchPlayers: playersHook.fetchPlayers,
    assignTicketsToPlayer: ticketsHook.assignTicketsToPlayer,
    getPlayerAssignedTickets: ticketsHook.getPlayerAssignedTickets,
    transitionToState,
    createSession,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextType {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
}

const generateSessionId = () => {
  return Math.random().toString(36).substr(2, 9); // Simple random ID generator
};
