
import { useState, useEffect, useCallback, useRef } from 'react';
import { setupNumberUpdateListeners } from './webSocketManager';
import { logWithTimestamp } from '@/utils/logUtils';
import { useSessionContext } from '@/contexts/SessionProvider';
import { NumberCalledPayload } from '@/types/websocket';

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
  
  // Generate a unique reference for this component instance to track listeners
  const listenersRef = useRef<(() => void)[]>([]);
  
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
    const handleNumberUpdate = (number: number, calledNumbers: number[]) => {
      log(`Received number update: ${number}, total numbers: ${calledNumbers.length}`, 'info');
      setNumbers(calledNumbers);
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
    
    // Set up the listener via SingleSourceTrueConnections
    const removeListener = setupNumberUpdateListeners(
      sessionId,
      handleNumberUpdate,
      handleGameReset,
      instanceId.current
    );
    
    // Store the cleanup function
    listenersRef.current.push(removeListener);
    
    // Clean up on unmount/change
    return () => {
      log('Cleaning up number update listeners', 'info');
      listenersRef.current.forEach(removeListener => removeListener());
      listenersRef.current = [];
      setConnectionState('disconnected');
    };
  }, [sessionId, log]);
  
  // Reset connection if session changes significantly
  useEffect(() => {
    // If there's a mismatch between our session ID and the current session context
    if (sessionId && currentSession && currentSession.id !== sessionId) {
      log(`Session changed from ${sessionId} to ${currentSession.id}, resetting`, 'info');
      setConnectionState('disconnected');
      
      // Clean up existing listeners
      listenersRef.current.forEach(removeListener => removeListener());
      listenersRef.current = [];
      
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
