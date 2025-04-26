
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GameSession, Player } from "@/types";
import { useTickets } from "./useTickets";

export type AdminTempPlayer = {
  playerCode: string;
  nickname: string;
  email: string;
  tickets: number;
};

export function usePlayers(sessions: GameSession[], fetchSessions: () => Promise<void>, assignTicketsToPlayer: ReturnType<typeof useTickets>["assignTicketsToPlayer"]) {
  const [players, setPlayers] = useState<Player[]>([]);

  // Helper to join session by player code
  const joinSession = async (playerCode: string): Promise<{ player: Player | null }> => {
    console.log(`Joining session with player code: ${playerCode}`);
    
    const { data, error } = await supabase.from('players').select('*').eq('player_code', playerCode).maybeSingle();
    if (error || !data) {
      console.error("Error finding player:", error);
      return { player: null };
    }
    
    const player = {
      id: data.id,
      sessionId: data.session_id,
      nickname: data.nickname,
      joinedAt: data.joined_at,
      playerCode: data.player_code,
      email: data.email,
      tickets: data.tickets
    };
    
    console.log(`Player found: ${player.nickname}, tickets: ${player.tickets}`);
    
    // Check if the player already has assigned tickets
    const { data: existingTicketsData, error: checkError } = await supabase
      .from('assigned_tickets')
      .select('id')
      .eq('player_id', player.id)
      .eq('session_id', player.sessionId);

    if (checkError) {
      console.error("Error checking assigned tickets:", checkError);
    }
    
    const ticketsCount = existingTicketsData ? existingTicketsData.length : 0;
    console.log(`Player has ${ticketsCount} tickets assigned, needs ${player.tickets} strips`);
    
    // Calculate how many strips (perms) the player needs
    // Each strip has 6 tickets, so we need to check unique perms
    const { data: existingPermsData } = await supabase
      .from('assigned_tickets')
      .select('perm')
      .eq('player_id', player.id)
      .eq('session_id', player.sessionId);
      
    // Get unique perm values
    const uniquePerms = existingPermsData ? [...new Set(existingPermsData.map(item => item.perm))] : [];
    const permsCount = uniquePerms.length;
    console.log(`Player has ${permsCount} strips (perms) assigned, needs ${player.tickets}`);
    
    if (permsCount < player.tickets) {
      console.log(`Assigning ${player.tickets - permsCount} more strips to player`);
      await assignTicketsToPlayer(player.id, player.sessionId, player.tickets);
    } else {
      console.log("Player already has all needed tickets assigned");
    }
    
    return { player };
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

  return { players, setPlayers, joinSession, addPlayer, bulkAddPlayers };
}
