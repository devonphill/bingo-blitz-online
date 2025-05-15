
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

export function useClaimBroadcaster() {
  /**
   * Broadcast a claim validation result to the player
   */
  const broadcastClaimResult = useCallback(async (
    playerId: string,
    playerUuid: string | undefined,
    result: 'valid' | 'rejected',
    additionalData?: any
  ) => {
    try {
      logWithTimestamp(`Broadcasting claim ${result} to player ${playerId}`, 'info');
      
      // Prepare broadcast payload
      const payload = {
        playerId: playerId,
        playerUuid: playerUuid,
        result: result,
        isGlobalBroadcast: false, // Target specific player
        timestamp: new Date().toISOString(),
        ...additionalData // Include any additional data passed
      };

      // Use the game-updates channel for consistency
      const channel = supabase.channel('game-updates');
      
      // Broadcast the claim result
      await channel.send({
        type: 'broadcast',
        event: 'claim-result',
        payload
      });
      
      logWithTimestamp(`Claim ${result} broadcast sent successfully`, 'info');
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWithTimestamp(`Error broadcasting claim ${result}: ${errorMsg}`, 'error');
      return false;
    }
  }, []);

  return {
    broadcastClaimResult
  };
}
