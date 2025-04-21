
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { GameSession, GameType, Player } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { PostgrestSingleResponse } from '@supabase/supabase-js';

interface SessionContextType {
  sessions: GameSession[];
  currentSession: GameSession | null;
  players: Player[];
  createSession: (name: string, gameType: GameType) => void;
  joinSession: (playerCode: string) => Promise<{ player: Player | null }>;
  setCurrentSession: (sessionId: string | null) => void;
  getSessionByCode: (code: string) => GameSession | null;
  bulkAddPlayers: (sessionId: string, players: AdminTempPlayer[]) => Promise<{ success: boolean, message?: string }>;
  addPlayer: (sessionId: string, playerCode: string, nickname: string) => Promise<boolean>;
}
type AdminTempPlayer = {
  playerCode: string;
  nickname: string;
  email: string;
  tickets: number;
};

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
      createdBy: 'currentUser', // Replace with actual user ID
      accessCode: generateAccessCode(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    setSessions([...sessions, newSession]);
    setCurrentSessionState(newSession);
  };

  // User login: Only code required, fetch nickname/tickets if found
  const joinSession = async (playerCode: string): Promise<{ player: Player | null }> => {
    const { data, error } = await supabase.from('players').select('*').eq('player_code', playerCode).maybeSingle();
    if (error || !data) return { player: null };
    return {
      player: {
        id: data.id,
        sessionId: data.session_id,
        nickname: data.nickname,
        joinedAt: data.joined_at,
        playerCode: data.player_code,
        email: data.email,
        tickets: data.tickets
      }
    };
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

  // Add a single player - FIXED: Don't pass numeric IDs as UUIDs
  const addPlayer = async (sessionId: string, playerCode: string, nickname: string): Promise<boolean> => {
    try {
      // Don't include an explicit ID, let Supabase generate a valid UUID
      const { error } = await supabase.from('players').insert({
        player_code: playerCode.toUpperCase(),
        nickname,
        session_id: sessionId,
        joined_at: new Date().toISOString(),
        tickets: 1
      });
      
      if (error) {
        console.error("Add player error:", error);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Add player exception:", err);
      return false;
    }
  };

  // Bulk add players with generated codes (and send email)
  const bulkAddPlayers = async (
    sessionId: string,
    newPlayers: AdminTempPlayer[],
  ): Promise<{ success: boolean; message?: string }> => {
    // Insert all players - FIXED: Don't include explicit IDs, let Supabase generate UUIDs
    const { error } = await supabase.from('players').insert(
      newPlayers.map(p => ({
        player_code: p.playerCode,
        nickname: p.nickname,
        email: p.email,
        tickets: p.tickets,
        session_id: sessionId,
        joined_at: new Date().toISOString()
      }))
    );

    if (error) {
      console.error("Bulk add error:", error);
      return { success: false, message: error.message };
    }
    
    // Placeholder: In a real app, call an Edge Function to send emails here
    // for (const p of newPlayers) await sendEmailToPlayer(p);
    return { success: true };
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
        getSessionByCode,
        bulkAddPlayers,
        addPlayer
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
