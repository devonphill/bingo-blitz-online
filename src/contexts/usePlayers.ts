
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Player, AdminTempPlayer, TempPlayer } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { generateAccessCode } from '@/utils/accessCodeGenerator';

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlayers = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', sessionId);
      
      if (error) {
        console.error('Error fetching players:', error);
        setError(error.message);
        return;
      }
      
      if (data) {
        // Convert raw data to Player objects with proper property names
        const playerObjects: Player[] = data.map(player => ({
          id: player.id,
          nickname: player.nickname,
          sessionId: player.session_id,
          tickets: player.tickets,
          playerCode: player.player_code,
          joinedAt: player.joined_at,
          email: player.email
        }));
        
        setPlayers(playerObjects);
      }
    } catch (err) {
      console.error('Exception in fetchPlayers:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const addPlayer = useCallback(async (sessionId: string, player: TempPlayer): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('players')
        .insert({
          session_id: sessionId,
          nickname: player.nickname,
          tickets: player.tickets,
          player_code: player.playerCode,
          email: player.email
        })
        .select('id')
        .single();
      
      if (error) {
        console.error('Error adding player:', error);
        setError(error.message);
        return null;
      }
      
      // Add new player to local state
      const newPlayer: Player = {
        id: data.id,
        nickname: player.nickname,
        sessionId,
        tickets: player.tickets,
        playerCode: player.playerCode,
        joinedAt: new Date().toISOString(),
        email: player.email
      };
      
      setPlayers(prev => [...prev, newPlayer]);
      return data.id;
      
    } catch (err) {
      console.error('Exception in addPlayer:', err);
      setError('An unexpected error occurred while adding player');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const addBulkPlayers = useCallback(async (sessionId: string, tempPlayers: AdminTempPlayer[]): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const playersData = tempPlayers.map(player => ({
        session_id: sessionId,
        nickname: player.nickname,
        tickets: player.ticketCount,
        player_code: player.playerCode || generateAccessCode(6),
        email: player.email
      }));
      
      const { error } = await supabase
        .from('players')
        .insert(playersData);
      
      if (error) {
        console.error('Error adding bulk players:', error);
        setError(error.message);
        return false;
      }
      
      // Reload players from database to get their IDs
      await fetchPlayers(sessionId);
      return true;
      
    } catch (err) {
      console.error('Exception in addBulkPlayers:', err);
      setError('An unexpected error occurred while adding players');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchPlayers]);
  
  const getPlayerByCode = useCallback((code: string): Player | undefined => {
    return players.find(p => p.playerCode === code);
  }, [players]);
  
  const updatePlayer = useCallback(async (playerId: string, updates: Partial<Player>): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Convert Player properties to database column names
      const dbUpdates: Record<string, any> = {};
      if ('nickname' in updates) dbUpdates.nickname = updates.nickname;
      if ('tickets' in updates) dbUpdates.tickets = updates.tickets;
      if ('playerCode' in updates) dbUpdates.player_code = updates.playerCode;
      if ('email' in updates) dbUpdates.email = updates.email;
      
      const { error } = await supabase
        .from('players')
        .update(dbUpdates)
        .eq('id', playerId);
      
      if (error) {
        console.error('Error updating player:', error);
        setError(error.message);
        return false;
      }
      
      // Update local state
      setPlayers(prev => 
        prev.map(player => 
          player.id === playerId ? { ...player, ...updates } : player
        )
      );
      
      return true;
    } catch (err) {
      console.error('Exception in updatePlayer:', err);
      setError('An unexpected error occurred while updating player');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const deletePlayer = useCallback(async (playerId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);
      
      if (error) {
        console.error('Error deleting player:', error);
        setError(error.message);
        return false;
      }
      
      // Update local state
      setPlayers(prev => prev.filter(player => player.id !== playerId));
      return true;
      
    } catch (err) {
      console.error('Exception in deletePlayer:', err);
      setError('An unexpected error occurred while deleting player');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return {
    players,
    fetchPlayers,
    addPlayer,
    addBulkPlayers,
    getPlayerByCode,
    updatePlayer,
    deletePlayer,
    isLoading,
    error
  };
}

// Re-export types for convenience
export type { Player, AdminTempPlayer, TempPlayer };
