
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Player, GameSession, AdminTempPlayer } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { generateAccessCode } from '@/utils/accessCodeGenerator';

export function usePlayers(
  sessions: GameSession[],
  refreshSessions: () => Promise<void>,
  assignTickets?: (playerId: string, sessionId: string, ticketCount: number) => Promise<any>
) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlayers = useCallback(async (sessionId: string) => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', sessionId);
        
      if (error) throw new Error(error.message);
      
      if (data) {
        // Map database fields to Player interface fields
        const mappedPlayers: Player[] = data.map(item => ({
          id: item.id,
          nickname: item.nickname,
          sessionId: item.session_id, // map session_id to sessionId
          joinedAt: item.joined_at,  // map joined_at to joinedAt
          tickets: item.tickets,
          playerCode: item.player_code, // map player_code to playerCode
          email: item.email
        }));
        
        setPlayers(mappedPlayers);
      }
    } catch (err) {
      console.error('Error fetching players:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const addPlayer = useCallback(async (nickname: string, sessionId: string, email?: string): Promise<Player> => {
    if (!nickname || !sessionId) {
      throw new Error('Nickname and session ID are required');
    }
    
    const playerCode = generateAccessCode(6);
    
    try {
      const { data, error } = await supabase
        .from('players')
        .insert({
          session_id: sessionId,
          nickname,
          email,
          player_code: playerCode,
          tickets: 1
        })
        .select()
        .single();
        
      if (error) throw new Error(`Failed to add player: ${error.message}`);
      
      // Convert to expected Player structure with proper field names
      const player: Player = {
        id: data.id,
        nickname: data.nickname,
        sessionId: data.session_id, // Map session_id to sessionId
        joinedAt: data.joined_at,   // Map joined_at to joinedAt
        playerCode: data.player_code, // Map player_code to playerCode
        tickets: data.tickets,
        email: data.email
      };
      
      setPlayers(prev => [...prev, player]);
      return player;
    } catch (err) {
      console.error('Error adding player:', err);
      throw err;
    }
  }, []);

  const bulkAddPlayers = useCallback(async (
    sessionId: string, 
    newPlayers: AdminTempPlayer[]
  ): Promise<{ success: boolean, message?: string }> => {
    if (!sessionId || !newPlayers.length) {
      return { success: false, message: 'Session ID or players data missing' };
    }
    
    try {
      // Format players for database insert
      const playersForInsert = newPlayers.map(player => ({
        id: uuidv4(),
        nickname: player.nickname,
        email: player.email,
        session_id: sessionId,
        player_code: player.playerCode || generateAccessCode(6),
        tickets: player.tickets || player.ticketCount || 1
      }));
      
      // Insert players
      const { error } = await supabase
        .from('players')
        .insert(playersForInsert);
        
      if (error) throw new Error(`Failed to add players: ${error.message}`);
      
      // Optionally assign tickets if function is provided
      if (assignTickets) {
        for (const player of playersForInsert) {
          if (player.tickets > 0) {
            await assignTickets(player.id, sessionId, player.tickets);
          }
        }
      }
      
      // Refresh players list
      await fetchPlayers(sessionId);
      
      return { 
        success: true, 
        message: `Successfully added ${playersForInsert.length} players` 
      };
    } catch (err) {
      console.error('Error bulk adding players:', err);
      return { 
        success: false, 
        message: `Failed to add players: ${(err as Error).message}` 
      };
    }
  }, [assignTickets, fetchPlayers]);

  const joinSession = useCallback(async (playerCode: string) => {
    if (!playerCode) {
      throw new Error('Player code is required');
    }
    
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('player_code', playerCode)
        .single();
        
      if (error) throw new Error(`Player not found: ${error.message}`);
      
      if (!data) {
        throw new Error('Player not found with the provided code');
      }
      
      // Find the session for this player
      const session = sessions.find(s => s.id === data.session_id);
      if (!session) {
        throw new Error('Associated session not found');
      }
      
      // Convert to expected Player structure with proper field names
      const player: Player = {
        id: data.id,
        nickname: data.nickname,
        sessionId: data.session_id, // Map session_id to sessionId
        joinedAt: data.joined_at,   // Map joined_at to joinedAt
        playerCode: data.player_code, // Map player_code to playerCode
        tickets: data.tickets,
        email: data.email
      };
      
      return { player, session };
    } catch (err) {
      console.error('Error joining session:', err);
      throw err;
    }
  }, [sessions]);

  return {
    players,
    loading,
    error,
    fetchPlayers,
    addPlayer,
    bulkAddPlayers,
    joinSession
  };
}

// Export AdminTempPlayer interface
export { AdminTempPlayer };
