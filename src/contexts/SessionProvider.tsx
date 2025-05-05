
import React, { createContext, useContext, ReactNode } from 'react';
import { useSessions } from './useSessions';
import { usePlayers } from './usePlayers';
import { useTickets } from './useTickets';
import type { GameSession, Player, TempPlayer } from '@/types';
import { AdminTempPlayer } from './usePlayers';
import { logWithTimestamp } from '@/utils/logUtils';

interface SessionContextType {
  sessions: GameSession[];
  currentSession: GameSession | null;
  setCurrentSession: (sessionId: string | null) => void;
  getSessionByCode: (code: string) => GameSession | null;
  fetchSessions: () => Promise<boolean>; // Changed from Promise<void> to Promise<boolean>
  updateSession: (sessionId: string, updates: Partial<GameSession>) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  // Player methods
  players?: Player[];
  joinSession: (playerCode: string) => Promise<{ success: boolean; playerCode?: string; playerId?: string; error?: string }>;
  addPlayer: (sessionId: string, player: TempPlayer) => Promise<string | null>;
  bulkAddPlayers: (sessionId: string, newPlayers: AdminTempPlayer[]) => Promise<{ success: boolean; message?: string; count?: number; error?: string }>;
  fetchPlayers?: (sessionId: string) => Promise<void>;
  // Ticket methods
  assignTicketsToPlayer?: (playerId: string, sessionId: string, ticketCount: number) => Promise<any>;
  getPlayerAssignedTickets?: (playerId: string, sessionId: string) => Promise<any>;
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
  
  // Initialize usePlayers with the ticketsHook.assignTicketsToPlayer function
  const playersHook = usePlayers(
    sessions,
    fetchSessions,
    ticketsHook.assignTicketsToPlayer
  );

  // Create a wrapper function for setCurrentSession that accepts a string
  const setCurrentSession = (sessionId: string | null) => {
    // Prevent unnecessary state updates if the session is already selected
    if (currentSession?.id === sessionId) {
      logWithTimestamp("Session is already selected, skipping update", 'debug');
      return;
    }
    
    logWithTimestamp(`Setting current session ID: ${sessionId || 'null'}`, 'info');
    setSessionById(sessionId);
  };

  const contextValue: SessionContextType = {
    sessions,
    currentSession,
    setCurrentSession,
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
