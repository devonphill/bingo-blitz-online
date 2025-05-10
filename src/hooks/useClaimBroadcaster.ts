
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateChannelType, ensureString } from '@/utils/typeUtils';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Hook for broadcasting claim validation results to players
 */
export function useClaimBroadcaster() {
  // Channel name constant for consistency
  const CLAIM_CHANNEL = 'game-updates';

  /**
   * Broadcasts claim validation result to the player and everyone in the session
   */
  const broadcastClaimResult = useCallback(async (
    playerId: string,
    actualPlayerId: string | null,
    result: 'valid' | 'rejected',
    sessionId?: string | null,
    playerName?: string | null,
    ticketInfo?: any
  ): Promise<boolean> => {
    try {
      logWithTimestamp(`Broadcasting claim result: ${result} to player ${playerId} and session ${sessionId || 'unknown'}`, 'info');
      
      // Use the consistent channel for all game updates
      const broadcastChannel = supabase.channel(CLAIM_CHANNEL);
      
      // Create a payload with all information needed for UI components
      const payload = {
        playerId: ensureString(actualPlayerId || playerId),
        playerName: ensureString(playerName || 'Player'),
        result,
        sessionId: sessionId ? ensureString(sessionId) : undefined,
        timestamp: new Date().toISOString(),
        isGlobalBroadcast: true, // Flag to indicate this is for everyone
        ticket: ticketInfo
      };
      
      // Send to UUID (actual player ID if available, otherwise the provided ID)
      await broadcastChannel.send({
        type: validateChannelType('broadcast'),
        event: 'claim-result',
        payload
      });
      
      // If we have both IDs and they're different, send to the original ID too
      if (actualPlayerId && actualPlayerId !== playerId) {
        await broadcastChannel.send({
          type: validateChannelType('broadcast'),
          event: 'claim-result',
          payload: {
            ...payload,
            playerId: ensureString(playerId) // Original player code
          }
        });
      }
      
      logWithTimestamp(`Claim result (${result}) broadcast sent to player ${playerId} and session ${sessionId || 'unknown'}`, 'info');
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
