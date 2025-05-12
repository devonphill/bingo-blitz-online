
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateChannelType, ensureString } from '@/utils/typeUtils';
import { logWithTimestamp } from '@/utils/logUtils';

// Define consistent channel names used across the application
const GAME_UPDATES_CHANNEL = 'game-updates';
const CLAIM_CHECKING_CHANNEL = 'claim_checking_broadcaster';
const CLAIM_RESULT_EVENT = 'claim-result';
const CLAIM_CHECKING_EVENT = 'claim-checking';

/**
 * Hook for broadcasting claim validation results to players
 */
export function useClaimBroadcaster() {
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
      if (!sessionId) {
        logWithTimestamp(`Cannot broadcast claim result without session ID`, 'error');
        return false;
      }

      logWithTimestamp(`Broadcasting claim result: ${result} to player ${playerId} and session ${sessionId}`, 'info');
      
      // Use the consistent channel name for all game updates with retry mechanism
      const broadcastWithRetry = async (attempts = 0): Promise<boolean> => {
        if (attempts >= 3) {
          logWithTimestamp(`Failed to broadcast claim result after ${attempts} attempts`, 'error');
          return false;
        }

        try {
          const broadcastChannel = supabase.channel(GAME_UPDATES_CHANNEL, {
            config: {
              broadcast: { 
                self: true, // Receive own broadcasts
                ack: true   // Request acknowledgment
              }
            }
          });
          
          // Create a payload with all information needed for UI components
          const payload = {
            playerId: ensureString(actualPlayerId || playerId),
            playerName: ensureString(playerName || 'Player'),
            result,
            sessionId: ensureString(sessionId),
            timestamp: new Date().toISOString(),
            isGlobalBroadcast: true, // Flag to indicate this is for everyone
            ticket: ticketInfo
          };
          
          logWithTimestamp(`Sending claim result broadcast with payload: ${JSON.stringify(payload)}`, 'debug');
          
          // Send to everyone in the session via broadcast
          await broadcastChannel.send({
            type: validateChannelType('broadcast'),
            event: CLAIM_RESULT_EVENT,
            payload
          });
          
          // If we have both IDs and they're different, send a specific event to the original ID too
          if (actualPlayerId && actualPlayerId !== playerId) {
            await broadcastChannel.send({
              type: validateChannelType('broadcast'),
              event: CLAIM_RESULT_EVENT,
              payload: {
                ...payload,
                playerId: ensureString(playerId), // Original player code
                isGlobalBroadcast: false // This is a personal notification
              }
            });
          }
          
          logWithTimestamp(`Claim result (${result}) broadcast sent to player ${playerId} and session ${sessionId}`, 'info');
          return true;
        } catch (err) {
          logWithTimestamp(`Error broadcasting claim result (attempt ${attempts + 1}): ${(err as Error).message}`, 'error');
          
          // Retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 250 * Math.pow(2, attempts)));
          return broadcastWithRetry(attempts + 1);
        }
      };
      
      return await broadcastWithRetry();
    } catch (err) {
      logWithTimestamp(`Error in broadcastClaimResult: ${(err as Error).message}`, 'error');
      return false;
    }
  }, []);

  /**
   * Broadcasts a claim being checked to all players
   */
  const broadcastClaimChecking = useCallback(async (
    claim: any,
    sessionId: string,
    message?: string
  ): Promise<boolean> => {
    try {
      if (!sessionId) {
        logWithTimestamp('Cannot broadcast claim checking without session ID', 'error');
        return false;
      }
      
      logWithTimestamp(`Broadcasting claim checking to all players in session ${sessionId}`, 'info');
      
      // Use the dedicated channel for claim checking broadcasts with retry mechanism
      const broadcastWithRetry = async (attempts = 0): Promise<boolean> => {
        if (attempts >= 3) {
          logWithTimestamp(`Failed to broadcast claim checking after ${attempts} attempts`, 'error');
          return false;
        }
        
        try {
          // Use both channels for maximum compatibility during transition
          const channels = [
            supabase.channel(GAME_UPDATES_CHANNEL, {
              config: { broadcast: { self: true, ack: true } }
            }),
            supabase.channel(CLAIM_CHECKING_CHANNEL, {
              config: { broadcast: { self: true, ack: true } }
            })
          ];
          
          // Ensure we have properly formatted ticket data for display
          const ticketData = claim.ticket ? {
            serial: claim.ticket.serial || '',
            numbers: claim.ticket.numbers || [],
            calledNumbers: claim.calledNumbers || [],
            layoutMask: claim.ticket.layoutMask || claim.ticket.layout_mask || 0
          } : null;
          
          // Create a payload with claim details including ticket information
          const payload = {
            claimId: ensureString(claim.id || `claim-${Date.now()}`),
            sessionId: ensureString(sessionId),
            playerId: ensureString(claim.playerId),
            playerName: ensureString(claim.playerName || 'Player'),
            timestamp: new Date().toISOString(),
            message: message || 'Claim being verified by caller',
            gameType: ensureString(claim.gameType || 'mainstage'),
            winPattern: ensureString(claim.winPattern || 'oneLine'),
            ticket: ticketData
          };
          
          logWithTimestamp(`Sending claim checking broadcast with payload: ${JSON.stringify(payload)}`, 'debug');
          
          // Send to all players via both channels for maximum compatibility
          for (const channel of channels) {
            await channel.send({
              type: validateChannelType('broadcast'),
              event: CLAIM_CHECKING_EVENT,
              payload
            });
          }
          
          logWithTimestamp(`Claim checking broadcast sent to session ${sessionId}`, 'info');
          return true;
        } catch (err) {
          logWithTimestamp(`Error broadcasting claim checking (attempt ${attempts + 1}): ${(err as Error).message}`, 'error');
          
          // Retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 250 * Math.pow(2, attempts)));
          return broadcastWithRetry(attempts + 1);
        }
      };
      
      return await broadcastWithRetry();
    } catch (err) {
      logWithTimestamp(`Error in broadcastClaimChecking: ${(err as Error).message}`, 'error');
      return false;
    }
  }, []);

  return {
    broadcastClaimResult,
    broadcastClaimChecking
  };
}
