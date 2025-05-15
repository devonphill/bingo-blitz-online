
import { logWithTimestamp } from '@/utils/logUtils';
import { ClaimData, ClaimResult } from '@/types/claim';
import { getWebSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';

/**
 * Service for broadcasting claim events using WebSocketService
 */
class ClaimBroadcastService {
  private instanceId: string;
  
  constructor() {
    this.instanceId = `claimBS-${Math.random().toString(36).substring(2, 7)}`;
    logWithTimestamp(`[${this.instanceId}] ClaimBroadcastService initialized`, 'info');
  }
  
  /**
   * Broadcast a new claim to the game-updates channel
   */
  public async broadcastClaimEvent(claim: ClaimData): Promise<boolean> {
    try {
      if (!claim || !claim.sessionId) {
        logWithTimestamp(`[${this.instanceId}] Cannot broadcast claim: Missing session ID`, 'error');
        return false;
      }

      logWithTimestamp(`[${this.instanceId}] Broadcasting claim ${claim.id} for player ${claim.playerName || claim.playerId} in session ${claim.sessionId}`);
      
      // Debug log the ticket object to verify it's arriving correctly
      console.log('[ClaimBroadcastService] Ticket object received for broadcast:', 
                  claim.ticket ? JSON.stringify(claim.ticket, null, 2) : 'No ticket data');

      // Make sure we have the full ticket object
      const ticketData = claim.ticket || {};

      // Clean up the payload to avoid circular references but include full ticket details
      const broadcastPayload = {
        // Core claim data
        claimId: claim.id,
        sessionId: claim.sessionId,
        playerId: claim.playerId,
        playerName: claim.playerName || 'unknown',
        playerCode: claim.playerCode,
        timestamp: claim.timestamp,
        status: claim.status || 'pending',
        
        // Game context
        gameType: claim.gameType || 'mainstage',
        gameNumber: claim.gameNumber || 1,
        winPattern: claim.winPattern || 'oneLine',
        
        // Ticket data - full details for validation with safe access
        ticket: {
          serial: typeof ticketData === 'object' && ticketData !== null && 'serial' in ticketData 
                  ? ticketData.serial 
                  : claim.ticketSerial || '',
          perm: typeof ticketData === 'object' && ticketData !== null && 'perm' in ticketData 
                ? Number(ticketData.perm) 
                : 0,
          position: typeof ticketData === 'object' && ticketData !== null && 'position' in ticketData 
                    ? Number(ticketData.position) 
                    : 0,
          layoutMask: typeof ticketData === 'object' && ticketData !== null 
                      ? ('layoutMask' in ticketData 
                        ? Number(ticketData.layoutMask) 
                        : ('layout_mask' in ticketData 
                          ? Number(ticketData.layout_mask) 
                          : 0))
                      : 0,
          numbers: typeof ticketData === 'object' && ticketData !== null && 'numbers' in ticketData 
                   && Array.isArray(ticketData.numbers) 
                   ? ticketData.numbers 
                   : [],
          calledNumbers: Array.isArray(claim.calledNumbers) ? claim.calledNumbers : []
        },
        
        // Called numbers for validation
        calledNumbers: Array.isArray(claim.calledNumbers) ? claim.calledNumbers : [],
        lastCalledNumber: claim.lastCalledNumber,
        hasLastCalledNumber: claim.hasLastCalledNumber || false,
        
        // Metadata
        claimed_at: claim.timestamp || new Date().toISOString(),
        toGoCount: claim.toGoCount || 0
      };

      // Log the full broadcast payload for debugging
      console.log('Final broadcast payload via WebSocket:', JSON.stringify(broadcastPayload, null, 2));

      // Use WebSocketService for consistent broadcasting
      const webSocketService = getWebSocketService();
      const success = await webSocketService.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.CLAIM_SUBMITTED,
        broadcastPayload
      );
      
      if (success) {
        logWithTimestamp(`[${this.instanceId}] Claim broadcast sent for player ${claim.playerName || claim.playerId}`);
      } else {
        logWithTimestamp(`[${this.instanceId}] Failed to broadcast claim`, 'error');
      }
      
      return success;
    } catch (err) {
      logWithTimestamp(`[${this.instanceId}] Error broadcasting claim: ${err}`, 'error');
      return false;
    }
  }

  /**
   * Broadcast a claim result to everyone in the session
   */
  public async broadcastClaimResult(result: ClaimResult): Promise<boolean> {
    try {
      const { sessionId, playerId, playerName, result: claimResult, ticket } = result;
      
      if (!sessionId) {
        logWithTimestamp(`[${this.instanceId}] Cannot broadcast claim result: Missing session ID`, 'error');
        return false;
      }
      
      // Log before broadcasting
      logWithTimestamp(`[${this.instanceId}] Broadcasting claim result: ${claimResult} for player ${playerName || playerId} in session ${sessionId}`, 'info');
      
      // Prepare payload
      const payload = {
        sessionId,
        playerId,
        playerName: playerName || 'Player',
        result: claimResult,
        timestamp: result.timestamp || new Date().toISOString(),
        isGlobalBroadcast: true, // Flag to indicate this is for everyone
        ticket: ticket ? {
          serial: ticket.serial || '',
          numbers: ticket.numbers,
          calledNumbers: ticket.calledNumbers
        } : undefined
      };
      
      // Use the WebSocketService
      const webSocketService = getWebSocketService();
      const success = await webSocketService.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.CLAIM_VALIDATION,
        payload
      );
      
      if (success) {
        logWithTimestamp(`[${this.instanceId}] Claim result broadcast successful`, 'info');
      } else {
        logWithTimestamp(`[${this.instanceId}] Failed to broadcast claim result`, 'error');
      }
      
      return success;
    } catch (err) {
      logWithTimestamp(`[${this.instanceId}] Error broadcasting claim result: ${err}`, 'error');
      return false;
    }
  }

  /**
   * Broadcast a claim being checked to all players in the session
   */
  public async broadcastClaimChecking(claim: ClaimData, sessionId: string): Promise<boolean> {
    try {
      // Log incoming parameters for debugging
      console.log('[ClaimBroadcastService] broadcastClaimChecking called with:');
      console.log('- sessionId parameter:', sessionId);
      console.log('- claim.sessionId:', claim.sessionId || claim.session_id);
      console.log('- claim object:', JSON.stringify(claim, null, 2));
      
      // Use either the passed sessionId or the one from the claim object
      const effectiveSessionId = sessionId || claim.sessionId || claim.session_id;
      
      // Log session ID for debugging
      console.log('[ClaimBroadcastService] Attempting to broadcast claim check. Session ID:', 
                 effectiveSessionId, 'Claim Data:', JSON.stringify(claim, null, 2));
      
      if (!effectiveSessionId) {
        logWithTimestamp(`[${this.instanceId}] Cannot broadcast claim check: Missing session ID`, 'error');
        console.error('Missing session ID for broadcast. Session ID:', effectiveSessionId);
        return false;
      }

      logWithTimestamp(`[${this.instanceId}] Broadcasting claim check for ${claim.playerName || claim.player_name || claim.playerId} in session ${effectiveSessionId}`, 'info');
      
      // Ensure we have properly formatted ticket data for display
      const ticketData = claim.ticket || claim.ticket_details || null;
      
      // Create a payload with claim details
      const broadcastPayload = {
        claimId: claim.id || 'unknown',
        sessionId: effectiveSessionId,
        playerId: claim.playerId || claim.player_id,
        playerName: claim.playerName || claim.player_name || 'unknown',
        playerCode: claim.playerCode || claim.player_code,
        timestamp: claim.timestamp || new Date().toISOString(),
        message: 'Claim being verified by caller',
        gameType: claim.gameType || 'mainstage',
        winPattern: claim.winPattern || claim.pattern_claimed || claim.patternClaimed || 'oneLine',
        ticket: ticketData ? {
          serial: typeof ticketData === 'object' && ticketData !== null && 'serial' in ticketData 
                  ? ticketData.serial 
                  : claim.ticketSerial || claim.ticket_serial || '',
          numbers: typeof ticketData === 'object' && ticketData !== null && 'numbers' in ticketData 
                   && Array.isArray(ticketData.numbers) 
                   ? ticketData.numbers 
                   : [],
          layoutMask: typeof ticketData === 'object' && ticketData !== null 
                      ? ('layoutMask' in ticketData 
                        ? Number(ticketData.layoutMask) 
                        : ('layout_mask' in ticketData 
                          ? Number(ticketData.layout_mask) 
                          : 0))
                      : 0,
          position: typeof ticketData === 'object' && ticketData !== null && 'position' in ticketData 
                    ? Number(ticketData.position) 
                    : 0
        } : null,
        calledNumbers: claim.calledNumbers || claim.called_numbers_snapshot || []
      };
      
      // Log the final broadcast payload
      console.log('[ClaimBroadcastService] Broadcasting claim check with payload:', JSON.stringify(broadcastPayload, null, 2));
      
      // Use WebSocketService
      const webSocketService = getWebSocketService();
      const success = await webSocketService.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.CLAIM_VALIDATING_TKT,
        broadcastPayload
      );
      
      if (success) {
        logWithTimestamp(`[${this.instanceId}] Claim check broadcast sent successfully`, 'info');
        // Dispatch a browser event as a backup mechanism
        try {
          const event = new CustomEvent('claimBroadcast', { 
            detail: { type: 'checking', claim: broadcastPayload } 
          });
          window.dispatchEvent(event);
          logWithTimestamp(`[${this.instanceId}] Also dispatched browser event for claim check`, 'info');
        } catch (eventError) {
          // Just log the error but don't fail the whole operation
          logWithTimestamp(`[${this.instanceId}] Error dispatching browser event: ${eventError}`, 'warn');
        }
      } else {
        logWithTimestamp(`[${this.instanceId}] Failed to broadcast claim check`, 'error');
      }
      
      return success;
    } catch (err) {
      logWithTimestamp(`[${this.instanceId}] Error broadcasting claim check: ${err}`, 'error');
      return false;
    }
  }
}

// Export singleton instance
export const claimBroadcastService = new ClaimBroadcastService();
