
import React, { createContext, useState, useContext, ReactNode } from 'react';
import { useSessions } from './useSessions';
import { usePlayers } from './usePlayers';
import { useTickets } from './useTickets';
import { useGameManager } from '@/contexts/GameManager'; // Import GameManager
import type { GameSession, Player, TempPlayer, GameType } from '@/types';
import { AdminTempPlayer } from './usePlayers';
import { logWithTimestamp } from '@/utils/logUtils';
import { v4 as uuidv4 } from 'uuid';

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

  const [session, setSession] = useState<GameSession | null>(null);

  const createSession = (gameTypeId: string) => {
    const gameType = currentGameType || { id: gameTypeId, name: "Unknown Game" };
    const newSession: GameSession = {
      id: uuidv4(),
      name: `Game Session ${new Date().toLocaleDateString()}`,
      gameType: gameTypeId as GameType, // Cast to GameType to ensure type safety
      createdBy: '',
      accessCode: '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      numberOfGames: 1,
      current_game: 1,
      lifecycle_state: 'setup',
      games_config: []
    };
    
    setSession(newSession);
    logWithTimestamp(`Session created with game type: ${gameType.name}`, 'info');
  };

  const transitionToState = (newState: string) => {
    const validStates = ["setup", "lobby", "live", "completed"] as const;
    
    if (validStates.includes(newState as any)) {
      setSession((prev) => {
        if (!prev) return null;
        return { 
          ...prev, 
          lifecycle_state: newState as "setup" | "live" | "ended" | "completed" 
        };
      });
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
