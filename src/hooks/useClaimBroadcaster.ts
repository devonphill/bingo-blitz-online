
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateChannelType, ensureString } from '@/utils/typeUtils';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Hook for broadcasting claim validation results to players
 */
export function useClaimBroadcaster() {
  /**
   * Broadcasts claim validation result to the player
   */
  const broadcastClaimResult = useCallback(async (
    playerId: string,
    actualPlayerId: string | null,
    result: 'valid' | 'rejected'
  ): Promise<boolean> => {
    try {
      // If we have both UUID and player code versions, send to both
      const broadcastChannel = supabase.channel('game-updates');
      
      // Send to UUID (actual player ID if available, otherwise the provided ID)
      await broadcastChannel.send({
        type: validateChannelType('broadcast'),
        event: 'claim-result',
        payload: {
          playerId: ensureString(actualPlayerId || playerId),
          result
        }
      });
      
      // If we have both IDs and they're different, send to the original ID too
      if (actualPlayerId && actualPlayerId !== playerId) {
        await broadcastChannel.send({
          type: validateChannelType('broadcast'),
          event: 'claim-result',
          payload: {
            playerId: ensureString(playerId), // Original player code
            result
          }
        });
      }
      
      logWithTimestamp(`Claim result (${result}) broadcast sent to player ${playerId}`, 'info');
      return true;
    } catch (err) {
      logWithTimestamp(`Error broadcasting claim result: ${(err as Error).message}`, 'error');
      return false;
    }
  }, []);

  return {
    broadcastClaimResult
  };
}
