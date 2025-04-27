
import React, { createContext, useContext, ReactNode } from 'react';
import { useSessions } from './useSessions';
import { usePlayers, AdminTempPlayer } from './usePlayers';
import { useTickets } from './useTickets';
import type { GameSession, Player } from '@/types';

interface SessionContextType {
  sessions: GameSession[];
  currentSession: GameSession | null;
  setCurrentSession: (sessionId: string | null) => void;
  getSessionByCode: (code: string) => GameSession | null;
  fetchSessions: () => Promise<void>;
  updateSession: (sessionId: string, updates: Partial<GameSession>) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  // Player methods
  players?: Player[];
  joinSession: (playerCode: string) => Promise<{ player: any | null, error: Error | null }>;
  addPlayer?: (nickname: string, sessionId: string, email?: string) => Promise<any>;
  bulkAddPlayers?: (sessionId: string, newPlayers: AdminTempPlayer[]) => Promise<{ success: boolean; message?: string }>;
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
  const playersHook = usePlayers(
    sessions,
    fetchSessions,
    ticketsHook.assignTicketsToPlayer
  );

  // Create a wrapper function for setCurrentSession that accepts a string
  const setCurrentSession = (sessionId: string | null) => {
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
        const result = await playersHook.joinSession(playerCode);
        return { player: result.player, error: null };
      } catch (error) {
        return { player: null, error: error as Error };
      }
    },
    addPlayer: playersHook.addPlayer,
    bulkAddPlayers: playersHook.bulkAddPlayers,
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
