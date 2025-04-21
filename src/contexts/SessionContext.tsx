
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GameSession, GameType, Player } from '@/types';
import { supabase } from '@/integrations/supabase/client';

interface AssignedTicket {
  id: string;
  player_id: string;
  session_id: string;
  serial: string;
  perm: number;
  position: number;
  layout_mask: number;
  numbers: number[];
  created_at: string;
}

interface TicketData {
  serial: string;
  perm: number;
  position: number;
  layout_mask: number;
  numbers: number[];
}

interface SessionContextType {
  sessions: GameSession[];
  currentSession: GameSession | null;
  players: Player[];
  joinSession: (playerCode: string) => Promise<{ player: Player | null }>;
  setCurrentSession: (sessionId: string | null) => void;
  getSessionByCode: (code: string) => GameSession | null;
  bulkAddPlayers: (sessionId: string, players: AdminTempPlayer[]) => Promise<{ success: boolean, message?: string }>;
  addPlayer: (sessionId: string, playerCode: string, nickname: string) => Promise<boolean>;
  fetchSessions: () => Promise<void>;
  assignTicketsToPlayer: (playerId: string, sessionId: string, ticketCount: number) => Promise<boolean>;
  getPlayerAssignedTickets: (playerId: string, sessionId: string) => Promise<AssignedTicket[]>;
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

  const fetchSessions = async () => {
    const { data, error } = await supabase.from('game_sessions').select('*');
    if (data) {
      setSessions(
        data.map((d: any) => ({
          id: d.id,
          name: d.name,
          gameType: d.game_type as GameType,
          createdBy: d.created_by,
          accessCode: d.access_code,
          status: d.status,
          createdAt: d.created_at,
          sessionDate: d.session_date,
          numberOfGames: d.number_of_games,
        }))
      );
    }
  };

  useEffect(() => {
    fetchSessions();

    const channel = supabase
      .channel('session-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions'
        },
        (payload: {
          eventType: string;
          new: Record<string, any> | null;
          old: Record<string, any> | null;
        }) => {
          console.log('Session change received:', payload);
          fetchSessions();

          if (currentSession && payload.new && currentSession.id === payload.new.id) {
            const updatedSession = {
              id: payload.new.id,
              name: payload.new.name,
              gameType: payload.new.game_type as GameType,
              createdBy: payload.new.created_by,
              accessCode: payload.new.access_code,
              status: payload.new.status,
              createdAt: payload.new.created_at,
              sessionDate: payload.new.session_date,
              numberOfGames: payload.new.number_of_games,
            };
            setCurrentSessionState(updatedSession);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSession]);

  const generateAccessCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const joinSession = async (playerCode: string): Promise<{ player: Player | null }> => {
    const { data, error } = await supabase.from('players').select('*').eq('player_code', playerCode).maybeSingle();
    if (error || !data) return { player: null };
    
    const player = {
      id: data.id,
      sessionId: data.session_id,
      nickname: data.nickname,
      joinedAt: data.joined_at,
      playerCode: data.player_code,
      email: data.email,
      tickets: data.tickets
    };
    
    // Use custom RPC function for the assigned_tickets check
    const { data: existingTickets, error: checkError } = await supabase
      .rpc<number>('get_player_assigned_tickets_count', { 
        p_player_id: player.id, 
        p_session_id: player.sessionId 
      });
      
    if (checkError) {
      console.error("Error checking assigned tickets:", checkError);
    }
    
    const ticketsCount = existingTickets || 0;
    if (ticketsCount === 0) {
      await assignTicketsToPlayer(player.id, player.sessionId, player.tickets);
    }
    
    return { player };
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

  const addPlayer = async (sessionId: string, playerCode: string, nickname: string): Promise<boolean> => {
    try {
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

  const bulkAddPlayers = async (
    sessionId: string,
    newPlayers: AdminTempPlayer[],
  ): Promise<{ success: boolean; message?: string }> => {
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
    
    return { success: true };
  };

  const getAvailableTickets = async (sessionId: string, count: number): Promise<TicketData[]> => {
    try {
      // Use custom RPC function for assigned tickets
      const { data: assignedTicketsData, error: assignedError } = await supabase
        .rpc<string[]>('get_assigned_ticket_serials_by_session', { 
          p_session_id: sessionId 
        });

      if (assignedError) {
        console.error("Error getting assigned tickets:", assignedError);
        return [];
      }

      // Convert the array result to a Set for efficient lookups
      const assignedSerials = new Set(assignedTicketsData || []);

      const { data: availableTickets, error: availableError } = await supabase
        .from('bingo_cards')
        .select('id, cells')
        .limit(count * 6);

      if (availableError) {
        console.error("Error getting available tickets:", availableError);
        return [];
      }

      const availableFormattedTickets: TicketData[] = [];
      
      if (availableTickets) {
        for (const ticket of availableTickets) {
          if (!assignedSerials.has(ticket.id) && availableFormattedTickets.length < count * 6) {
            const cells = ticket.cells as any;
            availableFormattedTickets.push({
              serial: ticket.id,
              perm: cells.perm || 1,
              position: cells.position || 1,
              layout_mask: cells.layout_mask || 0,
              numbers: cells.numbers || []
            });
          }
        }
      }

      const ticketsByPerm: Record<number, TicketData[]> = {};
      
      for (const ticket of availableFormattedTickets) {
        if (!ticketsByPerm[ticket.perm]) {
          ticketsByPerm[ticket.perm] = [];
        }
        ticketsByPerm[ticket.perm].push(ticket);
      }
      
      Object.values(ticketsByPerm).forEach(tickets => 
        tickets.sort((a, b) => a.position - b.position)
      );
      
      const result: TicketData[] = [];
      const permNumbers = Object.keys(ticketsByPerm).map(Number);
      
      for (let i = 0; i < count && i < permNumbers.length; i++) {
        const perm = ticketsByPerm[permNumbers[i]];
        if (perm && perm.length === 6) {
          result.push(...perm);
        }
      }
      
      return result;
    } catch (error) {
      console.error("Exception getting available tickets:", error);
      return [];
    }
  };

  const assignTicketsToPlayer = async (playerId: string, sessionId: string, ticketCount: number): Promise<boolean> => {
    try {
      // Check if player already has tickets using our RPC function
      const { data: existingTicketsCount, error: checkError } = await supabase
        .rpc<number>('get_player_assigned_tickets_count', { 
          p_player_id: playerId, 
          p_session_id: sessionId 
        });

      if (checkError) {
        console.error("Error checking tickets count:", checkError);
        return false;
      }

      // Check if the player already has tickets (ensure existingTicketsCount is a number)
      const ticketsCount = typeof existingTicketsCount === 'number' ? existingTicketsCount : 0;
      if (ticketsCount > 0) {
        console.log("Player already has tickets assigned");
        return true;
      }

      const availableTickets = await getAvailableTickets(sessionId, ticketCount);
      
      if (availableTickets.length < ticketCount * 6) {
        console.error(`Not enough available tickets: ${availableTickets.length} available, ${ticketCount * 6} needed`);
        return false;
      }

      // Use an RPC function to insert the tickets
      const ticketsToInsert = availableTickets.map(ticket => ({
        player_id: playerId,
        session_id: sessionId,
        serial: ticket.serial,
        perm: ticket.perm,
        position: ticket.position,
        layout_mask: ticket.layout_mask,
        numbers: ticket.numbers
      }));

      const { error: insertError } = await supabase
        .rpc<void>('insert_assigned_tickets', { tickets: ticketsToInsert });

      if (insertError) {
        console.error("Error assigning tickets:", insertError);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Exception assigning tickets:", error);
      return false;
    }
  };

  const getPlayerAssignedTickets = async (playerId: string, sessionId: string): Promise<AssignedTicket[]> => {
    try {
      // Use an RPC function to get the player's assigned tickets
      const { data, error } = await supabase
        .rpc<AssignedTicket[]>('get_player_assigned_tickets', { 
          p_player_id: playerId, 
          p_session_id: sessionId 
        });

      if (error) {
        console.error("Error getting assigned tickets:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Exception getting assigned tickets:", error);
      return [];
    }
  };

  return (
    <SessionContext.Provider
      value={{
        sessions,
        currentSession,
        players,
        joinSession,
        setCurrentSession,
        getSessionByCode,
        bulkAddPlayers,
        addPlayer,
        fetchSessions,
        assignTicketsToPlayer,
        getPlayerAssignedTickets
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
