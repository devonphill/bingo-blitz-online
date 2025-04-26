
import React, { createContext, useContext, ReactNode } from 'react';
import { useSessions } from './useSessions';
import { usePlayers } from './usePlayers';
import { useTickets } from './useTickets';
import type { GameSession, CurrentGameState, Player } from '@/types';

// Define the AdminTempPlayer type to match the one in usePlayers
type AdminTempPlayer = {
  playerCode: string;
  nickname: string;
  email: string;
  tickets: number;
};

interface SessionContextType {
  sessions: GameSession[];
  currentSession: GameSession | null;
  setCurrentSession: (sessionId: string | null) => void;
  getSessionByCode: (code: string) => GameSession | null;
  fetchSessions: () => Promise<void>;
  updateCurrentGameState: (newGameState: Partial<CurrentGameState>) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  // Player methods with correct types
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
  const sessionData = useSessions();
  const ticketsHook = useTickets();
  const playersHook = usePlayers(
    sessionData.sessions,
    sessionData.fetchSessions,
    ticketsHook.assignTicketsToPlayer
  );

  const contextValue: SessionContextType = {
    ...sessionData,
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
