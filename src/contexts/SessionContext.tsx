
import React, { createContext, useContext } from 'react';
import { useSessions } from './useSessions';
import { usePlayers } from './usePlayers';
import { TempPlayer, AdminTempPlayer, GameSession, Player } from '@/types';

interface SessionContextProps {
  sessions: GameSession[];
  currentSession: GameSession | null;
  fetchSessions: () => Promise<void>;
  updateSession: (sessionId: string, updates: Partial<GameSession>) => Promise<boolean>;
  setCurrentSession: (sessionId: string | null) => void;
  players: Player[];
  fetchPlayers: (sessionId: string) => Promise<void>;
  addPlayer: (sessionId: string, player: TempPlayer) => Promise<string | null>;
  removePlayer: (playerId: string) => Promise<boolean>;
  updatePlayer: (playerId: string, updates: Partial<Player>) => Promise<boolean>;
  joinSession: (playerCode: string) => Promise<any>;
  bulkAddPlayers: (sessionId: string, players: AdminTempPlayer[]) => Promise<any>;
  loading?: boolean;
  error: string;
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextProps | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    sessions,
    currentSession,
    fetchSessions,
    updateSession,
    setCurrentSession,
    isLoading: sessionsLoading,
    error: sessionsError
  } = useSessions();

  const {
    players,
    fetchPlayers,
    addPlayer,
    removePlayer,
    updatePlayer,
    joinSession,
    bulkAddPlayers,
    loading: playersLoading,
    error: playersError
  } = usePlayers();

  const loading = sessionsLoading || playersLoading;
  const error = sessionsError || playersError;

  return (
    <SessionContext.Provider
      value={{
        sessions,
        currentSession,
        fetchSessions,
        updateSession,
        setCurrentSession,
        players,
        fetchPlayers,
        addPlayer,
        removePlayer,
        updatePlayer,
        joinSession,
        bulkAddPlayers,
        loading,
        error,
        isLoading: loading
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSessionContext = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
};
