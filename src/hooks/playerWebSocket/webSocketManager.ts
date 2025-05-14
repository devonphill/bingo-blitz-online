
import { logWithTimestamp } from "@/utils/logUtils";
import { getWebSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';

/**
 * Registers listeners for WebSocket number updates
 */
export function setupNumberUpdateListeners(
  sessionId: string | null | undefined,
  onNumberUpdate: (number: number, numbers: number[]) => void,
  onGameReset: () => void,
  instanceId: string
) {
  if (!sessionId) {
    logWithTimestamp(`[${instanceId}] Cannot setup listeners: No session ID`, 'warn');
    return () => {};
  }

  logWithTimestamp(`[${instanceId}] Setting up number update listeners for session ${sessionId}`, 'info');
  
  // Get the WebSocket service instance
  const webSocketService = getWebSocketService();
  
  // Create and configure the channel
  const channel = webSocketService.createChannel(CHANNEL_NAMES.GAME_UPDATES);
  
  // Set up connection status tracking
  webSocketService.subscribeWithReconnect(CHANNEL_NAMES.GAME_UPDATES, (status) => {
    logWithTimestamp(`[${instanceId}] Number updates channel status: ${status}`, 'info');
  });
  
  // Add event handler for number updates
  const numberCleanup = webSocketService.addListener(
    CHANNEL_NAMES.GAME_UPDATES, 
    'broadcast', 
    EVENT_TYPES.NUMBER_CALLED, 
    (payload: any) => {
      if (!payload || !payload.payload) return;
      
      const { number, sessionId: payloadSessionId, calledNumbers } = payload.payload;
      
      // Ensure this event is for our session
      if (payloadSessionId !== sessionId) return;
      
      logWithTimestamp(`[${instanceId}] Received number update: ${number} for session ${payloadSessionId}`, 'info');
      
      // Pass both the new number and the complete array to ensure we have all numbers
      onNumberUpdate(number, calledNumbers || []);
    }
  );
  
  // Add handler for game reset events
  const resetCleanup = webSocketService.addListener(
    CHANNEL_NAMES.GAME_UPDATES,
    'broadcast',
    EVENT_TYPES.GAME_RESET,
    (payload: any) => {
      if (!payload || !payload.payload) return;
      
      const { sessionId: payloadSessionId } = payload.payload;
      
      // Ensure this event is for our session
      if (payloadSessionId !== sessionId) return;
      
      logWithTimestamp(`[${instanceId}] Received game reset for session ${payloadSessionId}`, 'info');
      
      onGameReset();
    }
  );
  
  // Return cleanup function
  return () => {
    numberCleanup();
    resetCleanup();
    logWithTimestamp(`[${instanceId}] Cleaned up number update listeners for session ${sessionId}`, 'info');
  };
}
