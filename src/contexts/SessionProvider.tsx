
import React, { createContext, useContext, ReactNode } from 'react';
import { useSessions } from './useSessions'; // Import the hook
import { usePlayers } from './usePlayers'; // Import players hook
import { useTickets } from './useTickets'; // Import tickets hook
import type { GameSession, CurrentGameState, Player } from '@/types'; // Import types

// Define the shape of the context value
interface SessionContextType {
  sessions: GameSession[];
  currentSession: GameSession | null;
  setCurrentSession: (sessionId: string | null) => void;
  getSessionByCode: (code: string) => GameSession | null;
  fetchSessions: () => Promise<void>;
  updateCurrentGameState: (newGameState: Partial<CurrentGameState>) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  // Player methods
  players?: Player[];
  joinSession: (playerCode: string) => Promise<{ player: any | null, error: Error | null }>;
  addPlayer?: (nickname: string, sessionId: string, email?: string) => Promise<any>;
  bulkAddPlayers?: (players: any[], sessionId: string) => Promise<any>;
  // Ticket methods
  assignTicketsToPlayer?: (playerId: string, sessionId: string, ticketCount: number) => Promise<any>;
  getPlayerAssignedTickets?: (playerId: string, sessionId: string) => Promise<any>;
}

// Create the context with a default undefined value
const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Define the Provider component
interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  // Use the session hook internally
  const sessionData = useSessions();
  
  // Use the player and ticket hooks
  const ticketsHook = useTickets();
  const playersHook = usePlayers(
    sessionData.sessions,
    sessionData.fetchSessions,
    ticketsHook.assignTicketsToPlayer
  );

  // The value provided by the context combines sessions with players and tickets functionality
  const contextValue: SessionContextType = {
    ...sessionData,
    // Player methods
    players: playersHook.players,
    joinSession: playersHook.joinSession,
    addPlayer: playersHook.addPlayer,
    bulkAddPlayers: playersHook.bulkAddPlayers,
    // Ticket methods
    assignTicketsToPlayer: ticketsHook.assignTicketsToPlayer,
    getPlayerAssignedTickets: ticketsHook.getPlayerAssignedTickets,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

// Custom hook to consume the context easily
export function useSessionContext(): SessionContextType {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
}
