
import { useState, useCallback, useRef } from 'react';
import { logWithTimestamp } from '@/utils/logUtils';
import { getWebSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';

/**
 * Hook for broadcasting claim-related messages via WebSocket
 */
export function useClaimBroadcaster() {
  const webSocketService = useRef(getWebSocketService());
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const instanceId = useRef(`claimBC-${Math.random().toString(36).substring(2, 9)}`);

  // Broadcast a claim result to a specific player
  const broadcastClaimResult = useCallback(async (
    playerCode: string,
    playerId: string,
    result: 'valid' | 'rejected'
  ) => {
    setIsBroadcasting(true);
    
    try {
      logWithTimestamp(`[${instanceId.current}] Broadcasting claim result: ${result} to player ${playerId}`, 'info');
      
      // Send the claim result via WebSocket
      const success = await webSocketService.current.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.CLAIM_VALIDATION,
        {
          playerCode,
          playerId,
          result,
          timestamp: new Date().toISOString()
        }
      );
      
      if (!success) {
        logWithTimestamp(`[${instanceId.current}] Failed to broadcast claim result`, 'error');
      }
      
      return success;
    } catch (error) {
      logWithTimestamp(`[${instanceId.current}] Error broadcasting claim result: ${error}`, 'error');
      return false;
    } finally {
      setIsBroadcasting(false);
    }
  }, []);

  // Broadcast a claim to all callers
  const broadcastClaimToCallers = useCallback(async (
    claimData: any
  ) => {
    setIsBroadcasting(true);
    
    try {
      logWithTimestamp(`[${instanceId.current}] Broadcasting claim to callers for session ${claimData.sessionId}`, 'info');
      
      // Send the claim via WebSocket
      const success = await webSocketService.current.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.CLAIM_SUBMITTED,
        claimData
      );
      
      if (!success) {
        logWithTimestamp(`[${instanceId.current}] Failed to broadcast claim to callers`, 'error');
      }
      
      return success;
    } catch (error) {
      logWithTimestamp(`[${instanceId.current}] Error broadcasting claim to callers: ${error}`, 'error');
      return false;
    } finally {
      setIsBroadcasting(false);
    }
  }, []);

  return {
    broadcastClaimResult,
    broadcastClaimToCallers,
    isBroadcasting
  };
}
