
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Player, TempPlayer } from '@/types';
import { generatePlayerCode } from '@/utils/accessCodeGenerator';

// Export the AdminTempPlayer interface
export interface AdminTempPlayer {
  nickname: string;
  email: string;
  ticketCount: number;
  playerCode?: string;
  tickets?: number;
}

export function usePlayers(
  sessions?: any[],
  refreshSessions?: () => Promise<void>,
  assignTicketsToPlayer?: (playerId: string, sessionId: string, ticketCount: number) => Promise<any>
) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPlayers = async (sessionId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', sessionId);

      if (error) throw error;

      const formattedPlayers = data.map(p => ({
        id: p.id,
        nickname: p.nickname,
        sessionId: p.session_id,
        tickets: p.tickets,
        playerCode: p.player_code,
        joinedAt: p.joined_at,
        email: p.email
      }));

      setPlayers(formattedPlayers);
    } catch (err: any) {
      console.error('Error fetching players:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addPlayer = async (sessionId: string, player: TempPlayer) => {
    try {
      const { data, error } = await supabase
        .from('players')
        .insert({
          nickname: player.nickname,
          email: player.email,
          tickets: player.tickets || 1,
          player_code: player.playerCode || generatePlayerCode(),
          session_id: sessionId
        })
        .select('id')
        .single();

      if (error) throw error;

      // If we have an assign tickets function, use it
      if (assignTicketsToPlayer && data?.id) {
        await assignTicketsToPlayer(data.id, sessionId, player.tickets || 1);
      }

      // Refresh the players list after adding
      await fetchPlayers(sessionId);
      
      return data?.id;
    } catch (err: any) {
      console.error('Error adding player:', err);
      setError(err.message);
      return null;
    }
  };

  const removePlayer = async (playerId: string) => {
    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);

      if (error) throw error;
      
      // Update local state
      setPlayers(prev => prev.filter(p => p.id !== playerId));
      return true;
    } catch (err: any) {
      console.error('Error removing player:', err);
      setError(err.message);
      return false;
    }
  };

  const updatePlayer = async (playerId: string, updates: Partial<Player>) => {
    try {
      // Map our data model to the database schema
      const dbUpdates: any = {};
      if (updates.nickname) dbUpdates.nickname = updates.nickname;
      if (updates.email) dbUpdates.email = updates.email;
      if (updates.tickets) dbUpdates.tickets = updates.tickets;
      if (updates.playerCode) dbUpdates.player_code = updates.playerCode;

      const { error } = await supabase
        .from('players')
        .update(dbUpdates)
        .eq('id', playerId);

      if (error) throw error;
      
      // Update local state
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, ...updates } : p));
      return true;
    } catch (err: any) {
      console.error('Error updating player:', err);
      setError(err.message);
      return false;
    }
  };

  const joinSession = async (playerCode: string): Promise<{
    success: boolean;
    playerCode?: string;
    playerId?: string;
    error?: string;
  }> => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, player_code, session_id')
        .eq('player_code', playerCode)
        .single();

      if (error) {
        return {
          success: false,
          error: 'Player not found with this code'
        };
      }

      return {
        success: true,
        playerCode: data.player_code,
        playerId: data.id
      };
    } catch (err: any) {
      console.error('Error joining session:', err);
      return {
        success: false,
        error: err.message
      };
    }
  };

  const bulkAddPlayers = async (sessionId: string, newPlayers: AdminTempPlayer[]): Promise<{
    success: boolean;
    message?: string;
    count?: number;
    error?: string;
  }> => {
    try {
      // Prepare players for insertion with generated player codes
      const playersToInsert = newPlayers.map(p => ({
        nickname: p.nickname,
        email: p.email,
        tickets: p.ticketCount || 1, // Use ticketCount for consistency
        player_code: generatePlayerCode(),
        session_id: sessionId
      }));

      const { data, error } = await supabase
        .from('players')
        .insert(playersToInsert)
        .select('id');

      if (error) throw error;

      // Assign tickets if function is available
      if (assignTicketsToPlayer && data) {
        for (let i = 0; i < data.length; i++) {
          const player = data[i];
          const ticketCount = newPlayers[i].ticketCount || 1;
          await assignTicketsToPlayer(player.id, sessionId, ticketCount);
        }
      }

      // Refresh players
      await fetchPlayers(sessionId);

      return {
        success: true,
        message: `Successfully added ${data?.length || 0} players`,
        count: data?.length || 0
      };
    } catch (err: any) {
      console.error('Error bulk adding players:', err);
      return {
        success: false,
        error: err.message,
        message: `Failed to add players: ${err.message}`
      };
    }
  };

  return {
    players,
    fetchPlayers,
    addPlayer,
    removePlayer,
    updatePlayer,
    joinSession,
    bulkAddPlayers,
    loading,
    error
  };
}
