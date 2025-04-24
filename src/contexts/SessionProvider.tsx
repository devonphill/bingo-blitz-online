// src/contexts/SessionProvider.tsx (Hypothetical structure - adapt to your actual file)
import React, { createContext, useContext, ReactNode } from 'react';
import { useSessions } from './useSessions'; // Import the hook
import type { GameSession, CurrentGameState } from '@/types'; // Import types

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
}

// Create the context with a default undefined value
const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Define the Provider component
interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  // Use the hook internally
  const sessionData = useSessions();

  // The value provided by the context will be the return value of the useSessions hook
  // No need to remap here, as useSessions already returns the correct structure
  const contextValue: SessionContextType = sessionData;

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
