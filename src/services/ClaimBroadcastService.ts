
import { logWithTimestamp } from '@/utils/logUtils';
import { ClaimData, ClaimResult } from '@/types/claim';
import { webSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/WebSocketService';

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

      // Clean up the payload to avoid circular references
      const broadcastPayload = {
        claimId: claim.id,
        sessionId: claim.sessionId,
        playerId: claim.playerId,
        playerName: claim.playerName || 'unknown',
        timestamp: claim.timestamp,
        toGoCount: claim.toGoCount || 0,
        gameType: claim.gameType || 'mainstage',
        winPattern: claim.winPattern || 'oneLine',
        // Sanitize ticket data to avoid circular references
        ticket: claim.ticket ? {
          serial: claim.ticket.serial,
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

      // Use WebSocketService for consistent broadcasting
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
      if (!claim || !sessionId) {
        logWithTimestamp(`[${this.instanceId}] Cannot broadcast claim check: Missing session ID`, 'error');
        return false;
      }

      logWithTimestamp(`[${this.instanceId}] Broadcasting claim check for ${claim.playerName || claim.playerId} in session ${sessionId}`, 'info');
      
      // Ensure we have properly formatted ticket data for display
      const ticketData = claim.ticket ? {
        serial: claim.ticket.serial || '',
        numbers: claim.ticket.numbers || [],
        calledNumbers: claim.calledNumbers || [],
        layoutMask: claim.ticket.layoutMask || 0
      } : null;
      
      // Create a payload with claim details
      const broadcastPayload = {
        claimId: claim.id || 'unknown',
        sessionId,
        playerId: claim.playerId,
        playerName: claim.playerName || 'unknown',
        timestamp: new Date().toISOString(),
        message: 'Claim being verified by caller',
        gameType: claim.gameType || 'mainstage',
        winPattern: claim.winPattern || 'oneLine',
        ticket: ticketData,
        calledNumbers: claim.calledNumbers || []
      };
      
      // Use WebSocketService
      const success = await webSocketService.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.CLAIM_VALIDATING_TKT,
        broadcastPayload
      );
      
      if (success) {
        logWithTimestamp(`[${this.instanceId}] Claim check broadcast sent successfully`, 'info');
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
