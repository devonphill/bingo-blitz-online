
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Player, TempPlayer, AdminTempPlayer } from '@/types';
import { generateAccessCode } from '@/utils/accessCodeGenerator';
import { useToast } from '@/hooks/use-toast';

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const fetchPlayers = useCallback(async (sessionId: string) => {
    try {
      setLoading(true);
      setError('');
      
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', sessionId);

      if (error) throw error;
      
      // Convert database schema to app schema
      const mappedPlayers: Player[] = data.map((player) => ({
        id: player.id,
        nickname: player.nickname,
        sessionId: player.session_id,
        tickets: player.tickets,
        playerCode: player.player_code,
        joinedAt: player.joined_at,
        email: player.email
      }));

      setPlayers(mappedPlayers);
    } catch (err) {
      setError((err as Error).message);
      console.error('Error fetching players:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  const addPlayer = useCallback(async (sessionId: string, player: TempPlayer) => {
    try {
      setLoading(true);
      setError('');
      
      const { data, error } = await supabase
        .from('players')
        .insert([
          { 
            session_id: sessionId,
            nickname: player.nickname,
            email: player.email,
            tickets: player.tickets,
            player_code: player.playerCode || generateAccessCode(6)
          }
        ])
        .select()
        .single();

      if (error) throw error;
      
      const newPlayer: Player = {
        id: data.id,
        nickname: data.nickname,
        sessionId: data.session_id,
        tickets: data.tickets,
        playerCode: data.player_code,
        joinedAt: data.joined_at,
        email: data.email
      };
      
      setPlayers(prev => [...prev, newPlayer]);
      
      return data.id;
    } catch (err) {
      setError((err as Error).message);
      console.error('Error adding player:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const joinSession = useCallback(async (nickname: string, sessionId: string, email?: string) => {
    try {
      setLoading(true);
      setError('');
      
      const playerCode = generateAccessCode(6);
      
      const { data, error } = await supabase
        .from('players')
        .insert([
          { 
            session_id: sessionId,
            nickname: nickname,
            email: email || null,
            tickets: 1, // Default ticket allocation
            player_code: playerCode
          }
        ])
        .select()
        .single();

      if (error) throw error;
      
      const player: Player = {
        id: data.id,
        nickname: data.nickname,
        sessionId: data.session_id,
        tickets: data.tickets,
        playerCode: data.player_code,
        joinedAt: data.joined_at,
        email: data.email
      };
      
      setPlayers(prev => [...prev, player]);
      
      return { success: true, playerCode, playerId: data.id };
    } catch (err) {
      setError((err as Error).message);
      console.error('Error joining session:', err);
      return { success: false, error: (err as Error).message };
    } finally {
      setLoading(false);
    }
  }, []);

  const bulkAddPlayers = useCallback(async (sessionId: string, tempPlayers: AdminTempPlayer[]) => {
    try {
      setLoading(true);
      setError('');
      
      const playersToInsert = tempPlayers.map(player => ({
        session_id: sessionId,
        nickname: player.nickname,
        email: player.email,
        tickets: player.tickets || player.ticketCount || 1,
        player_code: player.playerCode || generateAccessCode(6)
      }));
      
      const { data, error } = await supabase
        .from('players')
        .insert(playersToInsert)
        .select();

      if (error) throw error;
      
      // Convert database schema to app schema
      const newPlayers: Player[] = data.map((player) => ({
        id: player.id,
        nickname: player.nickname,
        sessionId: player.session_id,
        tickets: player.tickets,
        playerCode: player.player_code,
        joinedAt: player.joined_at,
        email: player.email
      }));
      
      setPlayers(prev => [...prev, ...newPlayers]);
      
      toast({
        title: "Success",
        description: `Added ${newPlayers.length} players to the session.`,
      });
      
      return { success: true, count: newPlayers.length };
    } catch (err) {
      setError((err as Error).message);
      console.error('Error bulk adding players:', err);
      return { success: false, error: (err as Error).message };
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const removePlayer = useCallback(async (playerId: string) => {
    try {
      setLoading(true);
      setError('');
      
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);

      if (error) throw error;
      
      setPlayers(prev => prev.filter(player => player.id !== playerId));
      return true;
    } catch (err) {
      setError((err as Error).message);
      console.error('Error removing player:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePlayer = useCallback(async (playerId: string, updates: Partial<Player>) => {
    try {
      setLoading(true);
      setError('');
      
      // Convert app schema to database schema
      const dbUpdates: any = {};
      if (updates.nickname) dbUpdates.nickname = updates.nickname;
      if (updates.email) dbUpdates.email = updates.email;
      if (updates.tickets) dbUpdates.tickets = updates.tickets;
      if (updates.playerCode) dbUpdates.player_code = updates.playerCode;
      
      const { data, error } = await supabase
        .from('players')
        .update(dbUpdates)
        .eq('id', playerId)
        .select()
        .single();

      if (error) throw error;
      
      const updatedPlayer: Player = {
        id: data.id,
        nickname: data.nickname,
        sessionId: data.session_id,
        tickets: data.tickets,
        playerCode: data.player_code,
        joinedAt: data.joined_at,
        email: data.email
      };
      
      setPlayers(prev => prev.map(p => p.id === playerId ? updatedPlayer : p));
      return true;
    } catch (err) {
      setError((err as Error).message);
      console.error('Error updating player:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

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
