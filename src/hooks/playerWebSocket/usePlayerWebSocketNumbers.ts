
import { useState, useEffect, useCallback, useRef } from 'react';
import { logWithTimestamp } from '@/utils/logUtils';
import { useSessionContext } from '@/contexts/SessionProvider';
import { NumberCalledPayload } from '@/types/websocket';
import { useWebSocket } from '@/hooks/useWebSocket';

/**
 * Hook for listening to number updates via WebSocket
 * 
 * @param sessionId Session ID to listen for updates from
 * @returns Called numbers and connection state
 */
export function usePlayerWebSocketNumbers(sessionId: string | null | undefined) {
  const [numbers, setNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('disconnected');
  const { currentSession } = useSessionContext();
  
  // Create unique instance ID for this hook
  const instanceId = useRef(`WSNum-${Math.random().toString(36).substring(2, 9)}`);
  
  // Use the consolidated WebSocket hook
  const { listenForEvent, EVENTS, isConnected: wsConnected, connectionState: wsConnectionState } = useWebSocket(sessionId);
  
  // Custom log helper
  const log = useCallback((message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') => {
    logWithTimestamp(`[${instanceId.current}] ${message}`, level);
  }, []);
  
  // Set up event listeners for number updates
  useEffect(() => {
    if (!sessionId) {
      log('No session ID provided, skipping setup', 'warn');
      setConnectionState('disconnected');
      return;
    }
    
    log(`Setting up listeners for session ${sessionId}`, 'info');
    setConnectionState('connecting');
    
    // Handle new number broadcasts
    const handleNumberUpdate = (data: NumberCalledPayload) => {
      const { number, calledNumbers } = data;
      log(`Received number update: ${number}, total numbers: ${calledNumbers?.length || 0}`, 'info');
      
      if (calledNumbers && Array.isArray(calledNumbers)) {
        setNumbers(calledNumbers);
      } else {
        // If we only got the new number, append it
        setNumbers(prev => [...prev, number]);
      }
      
      setLastCalledNumber(number);
      setConnectionState('connected');
      setIsConnected(true);
    };
    
    // Handle game reset
    const handleGameReset = () => {
      log('Game reset detected', 'info');
      setNumbers([]);
      setLastCalledNumber(null);
    };
    
    // Set up listeners using the useWebSocket hook
    const numberCleanup = listenForEvent(
      EVENTS.NUMBER_CALLED,
      handleNumberUpdate
    );
    
    const resetCleanup = listenForEvent(
      EVENTS.GAME_RESET,
      handleGameReset
    );
    
    // Update connection state based on WebSocket connection
    setIsConnected(wsConnected);
    setConnectionState(
      wsConnectionState === 'SUBSCRIBED' ? 'connected' :
      wsConnectionState === 'CONNECTING' || wsConnectionState === 'JOINING' ? 'connecting' :
      wsConnectionState === 'error' ? 'error' : 'disconnected'
    );
    
    // Clean up on unmount/change - call both cleanup functions
    return () => {
      log('Cleaning up number update listeners', 'info');
      numberCleanup();
      resetCleanup();
      // We do NOT call any global disconnect here
    };
  }, [sessionId, log, listenForEvent, EVENTS, wsConnected, wsConnectionState]);
  
  // Reset connection if session changes significantly
  useEffect(() => {
    // If there's a mismatch between our session ID and the current session context
    if (sessionId && currentSession && currentSession.id !== sessionId) {
      log(`Session changed from ${sessionId} to ${currentSession.id}, resetting`, 'info');
      setConnectionState('disconnected');
      
      // Reset state
      setNumbers([]);
      setLastCalledNumber(null);
      setIsConnected(false);
    }
  }, [currentSession, sessionId, log]);

  return {
    calledNumbers: numbers,
    lastCalledNumber,
    isConnected,
    connectionState
  };
}
