
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { GameSession, GameType, Player } from '@/types';

interface SessionContextType {
  sessions: GameSession[];
  currentSession: GameSession | null;
  players: Player[];
  createSession: (name: string, gameType: GameType) => void;
  joinSession: (accessCode: string, nickname: string) => Promise<boolean>;
  setCurrentSession: (sessionId: string | null) => void;
  getSessionByCode: (code: string) => GameSession | null;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

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

  const joinSession = async (accessCode: string, nickname: string): Promise<boolean> => {
    const session = sessions.find(s => s.accessCode === accessCode);
    
    if (!session) {
      return false;
    }
    
    const newPlayer: Player = {
      id: Date.now().toString(),
      sessionId: session.id,
      nickname,
      joinedAt: new Date().toISOString()
    };
    
    setPlayers([...players, newPlayer]);
    setCurrentSessionState(session);
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
