
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GameSession, Player } from "@/types";
import { useTickets } from "./useTickets";
import { SupabaseRpcFunction } from "@/integrations/supabase/customTypes";

type AdminTempPlayer = {
  playerCode: string;
  nickname: string;
  email: string;
  tickets: number;
};

// Handles adding and fetching players, joining sessions, and bulk actions
export function usePlayers(sessions: GameSession[], fetchSessions: () => Promise<void>, assignTicketsToPlayer: ReturnType<typeof useTickets>["assignTicketsToPlayer"]) {
  const [players, setPlayers] = useState<Player[]>([]);

  // Helper to join session by player code
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
    
    // Call as plain string—not typed variable
    const { data: existingTickets, error: checkError } = await supabase
      .rpc("get_player_assigned_tickets_count" as SupabaseRpcFunction, { 
        p_player_id: player.id, 
        p_session_id: player.sessionId 
      });
    if (checkError) {
      console.error("Error checking assigned tickets:", checkError);
    }
    const ticketsCount = typeof existingTickets === 'number' ? existingTickets : 0;
    if (ticketsCount === 0) {
      await assignTicketsToPlayer(player.id, player.sessionId, player.tickets);
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
