
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { validateChannelType, ensureString } from '@/utils/typeUtils';
import { ClaimData, ClaimResult } from '@/types/claim';

/**
 * Service for broadcasting claim events to Supabase real-time channels
 */
class ClaimBroadcastService {
  // Channel name constants
  private readonly CLAIM_CHANNEL = 'game-updates';
  private readonly CLAIM_CHECKING_CHANNEL = 'claim_checking_broadcaster';
  private readonly CLAIM_RESULT_EVENT = 'claim-result';
  private readonly CLAIM_SUBMITTED_EVENT = 'claim-submitted';
  private readonly CLAIM_CHECKING_EVENT = 'claim-checking';

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

      // Use consistent channel name for all claim-related broadcasts
      const broadcastChannel = supabase.channel(this.CLAIM_CHANNEL);
      
      // Broadcast the claim to all listeners - use consistent event name
      await broadcastChannel.send({
        type: validateChannelType('broadcast'), 
        event: this.CLAIM_SUBMITTED_EVENT,
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
   * Broadcast a claim result to everyone in the session
   */
  public async broadcastClaimResult(result: ClaimResult): Promise<boolean> {
    try {
      const { sessionId, playerId, playerName, result: claimResult, ticket } = result;
      
      // Use consistent channel name for claim result broadcasts
      const broadcastChannel = supabase.channel(this.CLAIM_CHANNEL);
      
      // Log before broadcasting
      logWithTimestamp(`Broadcasting claim result: ${claimResult} for player ${playerName || playerId} in session ${sessionId}`, 'info');
      
      // Broadcast to all clients with session information so everyone knows
      await broadcastChannel.send({
        type: validateChannelType('broadcast'),
        event: this.CLAIM_RESULT_EVENT,
        payload: {
          sessionId: ensureString(sessionId),
          playerId: ensureString(playerId),
          playerName: ensureString(playerName || 'Player'),
          result: claimResult,
          timestamp: result.timestamp || new Date().toISOString(),
          isGlobalBroadcast: true, // Flag to indicate this is for everyone
          ticket: ticket ? {
            serial: ensureString(ticket.serial || ''),
            numbers: ticket.numbers,
            calledNumbers: ticket.calledNumbers
          } : undefined
        }
      });
      
      logWithTimestamp(`Broadcast claim result sent: ${claimResult} for player ${playerName || playerId}`, 'info');
      return true;
    } catch (err) {
      console.error("Error broadcasting claim result:", err);
      return false;
    }
  }

  /**
   * Broadcast a claim being checked to all players in the session
   */
  public async broadcastClaimChecking(claim: ClaimData, sessionId: string): Promise<boolean> {
    try {
      if (!claim || !sessionId) {
        logWithTimestamp('Cannot broadcast claim check: Missing session ID', 'error');
        console.error('Cannot broadcast claim check: Missing session ID');
        return false;
      }

      logWithTimestamp(`Broadcasting claim check for ${claim.playerName || claim.playerId} in session ${sessionId}`, 'info');
      console.log('BROADCASTING CLAIM CHECK:', {
        playerName: claim.playerName || claim.playerId,
        sessionId: sessionId,
        channel: this.CLAIM_CHECKING_CHANNEL,
        event: this.CLAIM_CHECKING_EVENT
      });
      
      // Ensure we have properly formatted ticket data for display
      const ticketData = claim.ticket ? {
        serial: claim.ticket.serial || '',
        numbers: claim.ticket.numbers || [],
        calledNumbers: claim.calledNumbers || [],
        layoutMask: claim.ticket.layoutMask || claim.ticket.layout_mask || 0
      } : null;
      
      // Create a payload with claim details
      const broadcastPayload = {
        claimId: ensureString(claim.id || 'unknown'),
        sessionId: ensureString(sessionId),
        playerId: ensureString(claim.playerId),
        playerName: ensureString(claim.playerName || 'unknown'),
        timestamp: new Date().toISOString(),
        message: 'Claim being verified by caller',
        gameType: ensureString(claim.gameType || 'mainstage'),
        winPattern: ensureString(claim.winPattern || 'oneLine'),
        // Sanitize ticket data to avoid circular references
        ticket: ticketData,
        calledNumbers: claim.calledNumbers || []
      };
      
      console.log('CLAIM CHECK PAYLOAD:', broadcastPayload);
      
      // Use the dedicated channel with improved config
      const broadcastChannel = supabase.channel(this.CLAIM_CHECKING_CHANNEL, {
        config: {
          broadcast: { 
            self: true, // Ensure sender receives their own events
            ack: true   // Request acknowledgement
          }
        }
      });
      
      // Broadcast the claim check to all listeners
      await broadcastChannel.send({
        type: validateChannelType('broadcast'),
        event: this.CLAIM_CHECKING_EVENT,
        payload: broadcastPayload
      });
      
      logWithTimestamp(`Claim check broadcast sent for ${claim.playerName || claim.playerId}`, 'info');
      console.log('CLAIM CHECK BROADCAST SENT SUCCESSFULLY');
      return true;
    } catch (err) {
      console.error("Error broadcasting claim check:", err);
      logWithTimestamp(`Error broadcasting claim check: ${(err as Error).message}`, 'error');
      return false;
    }
  }
}

// Export a singleton instance
export const claimBroadcastService = new ClaimBroadcastService();
