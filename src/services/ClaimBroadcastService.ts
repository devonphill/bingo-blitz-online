
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { validateChannelType, ensureString } from '@/utils/typeUtils';
import { ClaimData, ClaimResult } from '@/types/claim';

/**
 * Service for broadcasting claim events to Supabase real-time channels
 */
class ClaimBroadcastService {
  /**
   * Broadcast a new claim to the game-updates channel
   */
  public async broadcastClaimEvent(claim: ClaimData): Promise<boolean> {
    try {
      if (!claim || !claim.sessionId) {
        console.error('Cannot broadcast claim: Missing session ID');
        return false;
      }

      logWithTimestamp(`Broadcasting claim ${claim.id} for player ${claim.playerName || claim.playerId} in session ${claim.sessionId}`);

      // Clean up the payload to avoid circular references
      const broadcastPayload = {
        claimId: ensureString(claim.id),
        sessionId: ensureString(claim.sessionId),
        playerId: ensureString(claim.playerId),
        playerName: ensureString(claim.playerName || 'unknown'),
        timestamp: claim.timestamp,
        toGoCount: claim.toGoCount || 0,
        gameType: ensureString(claim.gameType || 'mainstage'),
        winPattern: ensureString(claim.winPattern || 'oneLine'),
        // Sanitize ticket data to avoid circular references
        ticket: claim.ticket ? {
          serial: ensureString(claim.ticket.serial),
          perm: claim.ticket.perm,
          position: claim.ticket.position,
          layoutMask: claim.ticket.layoutMask,
          numbers: claim.ticket.numbers,
          calledNumbers: claim.ticket.calledNumbers || []
        } : undefined,
        calledNumbers: claim.calledNumbers || [],
        lastCalledNumber: claim.lastCalledNumber,
        hasLastCalledNumber: claim.hasLastCalledNumber || false
      };

      // Log the actual payload we're sending for debugging
      logWithTimestamp(`Broadcast payload: ${JSON.stringify(broadcastPayload)}`, 'debug');

      // Use consistent channel name "game-updates" for all claim-related broadcasts
      const broadcastChannel = supabase.channel('game-updates');
      
      // Broadcast the claim to all listeners - use consistent event name "claim-submitted"
      await broadcastChannel.send({
        type: validateChannelType('broadcast'), 
        event: 'claim-submitted',
        payload: broadcastPayload
      });
      
      logWithTimestamp(`Claim broadcast sent for player ${claim.playerName || claim.playerId}`);
      return true;
    } catch (err) {
      console.error("Error broadcasting claim:", err);
      return false;
    }
  }

  /**
   * Broadcast a claim result to the player who made the claim
   */
  public async broadcastClaimResult(result: ClaimResult): Promise<boolean> {
    try {
      const { sessionId, playerId, playerName, result: claimResult, ticket } = result;
      
      // Use consistent channel name "claim-results-channel" for result broadcasts
      const broadcastChannel = supabase.channel('claim-results-channel');
      
      // Log before broadcasting
      logWithTimestamp(`Broadcasting claim result: ${claimResult} for player ${playerName || playerId} in session ${sessionId}`, 'info');
      
      // Broadcast to all clients - they'll filter based on their own player ID
      await broadcastChannel.send({
        type: validateChannelType('broadcast'),
        event: 'claim-result',
        payload: {
          sessionId: ensureString(sessionId),
          playerId: ensureString(playerId),
          playerName: ensureString(playerName),
          result: claimResult,
          timestamp: result.timestamp,
          ticket: ticket ? {
            serial: ensureString(ticket.serial || ''),
            numbers: ticket.numbers,
            calledNumbers: ticket.calledNumbers
          } : undefined
        }
      });
      
      logWithTimestamp(`Broadcast claim result sent: ${claimResult} for player ${playerName || playerId}`);
      return true;
    } catch (err) {
      console.error("Error broadcasting claim result:", err);
      return false;
    }
  }
}

// Export a singleton instance
export const claimBroadcastService = new ClaimBroadcastService();
