
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { GameSession, GameType, Player } from '@/types';

interface SessionContextType {
  sessions: GameSession[];
  currentSession: GameSession | null;
  players: Player[];
  createSession: (name: string, gameType: GameType) => void;
  joinSession: (playerCode: string, nickname: string) => Promise<boolean>;
  setCurrentSession: (sessionId: string | null) => void;
  getSessionByCode: (code: string) => GameSession | null;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

function generatePlayerCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateUniquePlayerCode(existingCodes: string[], length = 6): string {
  let code = generatePlayerCode(length);
  // Avoid collisions with existing codes
  while (existingCodes.includes(code)) {
    code = generatePlayerCode(length);
  }
  return code;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [currentSession, setCurrentSessionState] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  const generateAccessCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const createSession = (name: string, gameType: GameType) => {
    const newSession: GameSession = {
      id: Date.now().toString(),
      name,
      gameType,
      createdBy: 'currentUser', // This would be the actual user ID
      accessCode: generateAccessCode(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    setSessions([...sessions, newSession]);
    setCurrentSessionState(newSession);
  };

  // Updated joinSession to use playerCode, enforce uniqueness of playerCode
  const joinSession = async (playerCode: string, nickname: string): Promise<boolean> => {
    // Check if the playerCode already exists (enforce uniqueness)
    const existingPlayer = players.find(p => p.playerCode === playerCode);
    if (existingPlayer) {
      // Player code already used, do not join
      return false;
    }

    // For now, assign the new player to the currentSession
    if (!currentSession) {
      return false;
    }

    const newPlayer: Player = {
      id: Date.now().toString(),
      sessionId: currentSession.id,
      nickname,
      joinedAt: new Date().toISOString(),
      playerCode
    };

    setPlayers([...players, newPlayer]);
    return true;
  };

  const setCurrentSession = (sessionId: string | null) => {
    if (!sessionId) {
      setCurrentSessionState(null);
      return;
    }
    const session = sessions.find(s => s.id === sessionId);
    setCurrentSessionState(session || null);
  };

  const getSessionByCode = (code: string): GameSession | null => {
    return sessions.find(s => s.accessCode === code) || null;
  };

  return (
    <SessionContext.Provider
      value={{
        sessions,
        currentSession,
        players,
        createSession,
        joinSession,
        setCurrentSession,
        getSessionByCode
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
