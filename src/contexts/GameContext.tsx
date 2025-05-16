
import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePlayerTickets, PlayerTicket } from '@/hooks/usePlayerTickets'; 
import { usePlayerContext } from './PlayerContext';
import { useSessionContext } from './SessionProvider';
import { useWebSocket } from '@/hooks/useWebSocket';
import { logWithTimestamp } from '@/utils/logUtils';

interface GameContextData {
  calledNumbers: number[];
  lastCalledNumber: number | null;
  currentWinPattern: string | null;
  playerTickets: PlayerTicket[];
  winningTickets: PlayerTicket[];
  isLoadingTickets: boolean;
}

const GameContext = createContext<GameContextData | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { player } = usePlayerContext();
  const { currentSession } = useSessionContext();
  const sessionId = player?.sessionId || null;
  
  // Only set up WebSocket when we have a valid session ID
  const { listenForEvent, EVENTS, isConnected, connectionState } = useWebSocket(sessionId);
  
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [currentWinPattern, setCurrentWinPattern] = useState<string | null>(null);
  
  // Create a unique ID for this component instance
  const instanceId = React.useRef(`GameContext-${Math.random().toString(36).substring(2, 7)}`).current;
  
  // Use the PlayerTickets hook to fetch and manage tickets
  const { 
    playerTickets, 
    isLoadingTickets,
    updateWinningStatus,
    currentWinningTickets
  } = usePlayerTickets(sessionId);
  
  // Listen for number called updates
  useEffect(() => {
    // Only set up listeners if we have a valid session ID and connection
    if (!sessionId) {
      logWithTimestamp(`[${instanceId}] No session ID available, skipping number listener setup`, 'warn');
      return;
    }
    
    // Check connection state before setting up listeners
    if (connectionState !== 'SUBSCRIBED' && connectionState !== 'connected') {
      logWithTimestamp(`[${instanceId}] Connection not ready (state: ${connectionState}), deferring number listener setup`, 'warn');
      return;
    }
    
    logWithTimestamp(`[${instanceId}] Setting up number called listener for session ${sessionId}`, 'info');
    const removeNumberListener = listenForEvent(
      EVENTS.NUMBER_CALLED, 
      (data: any) => {
        logWithTimestamp(`[${instanceId}] Number called update: ${JSON.stringify(data)}`);
        
        if (data.number !== undefined) {
          setLastCalledNumber(data.number);
        }
        
        if (data.calledNumbers && Array.isArray(data.calledNumbers)) {
          setCalledNumbers(data.calledNumbers);
          
          // Update winning status when new numbers are called
          if (currentWinPattern) {
            updateWinningStatus(data.calledNumbers, currentWinPattern);
          }
        }
      }
    );
    
    // Clean up when unmounting or session/connection state changes
    return () => {
      logWithTimestamp(`[${instanceId}] Cleaning up number called listener`, 'info');
      removeNumberListener();
    };
  }, [sessionId, currentWinPattern, listenForEvent, EVENTS, updateWinningStatus, connectionState, instanceId]);
  
  // Listen for game state updates
  useEffect(() => {
    // Only set up listeners if we have a valid session ID and connection
    if (!sessionId) {
      logWithTimestamp(`[${instanceId}] No session ID available, skipping game state listener setup`, 'warn');
      return;
    }
    
    // Check connection state before setting up listeners
    if (connectionState !== 'SUBSCRIBED' && connectionState !== 'connected') {
      logWithTimestamp(`[${instanceId}] Connection not ready (state: ${connectionState}), deferring game state listener setup`, 'warn');
      return;
    }
    
    logWithTimestamp(`[${instanceId}] Setting up game state listener for session ${sessionId}`, 'info');
    const removeStateListener = listenForEvent(
      EVENTS.GAME_STATE_UPDATE,
      (gameState: any) => {
        if (gameState?.currentWinPattern) {
          logWithTimestamp(`[${instanceId}] Win pattern update`, gameState.currentWinPattern);
          setCurrentWinPattern(gameState.currentWinPattern);
          
          // Update winning status when pattern changes
          if (calledNumbers.length > 0) {
            updateWinningStatus(calledNumbers, gameState.currentWinPattern);
          }
        }
        
        // Update called numbers from game state if available
        if (gameState?.calledNumbers && Array.isArray(gameState.calledNumbers)) {
          setCalledNumbers(gameState.calledNumbers);
          
          if (gameState.calledNumbers.length > 0) {
            setLastCalledNumber(gameState.calledNumbers[gameState.calledNumbers.length - 1]);
          }
        }
      }
    );
    
    // Clean up when unmounting or session/connection state changes
    return () => {
      logWithTimestamp(`[${instanceId}] Cleaning up game state listener`, 'info');
      removeStateListener();
    };
  }, [sessionId, calledNumbers, listenForEvent, EVENTS, updateWinningStatus, connectionState, instanceId]);
  
  const value = {
    calledNumbers,
    lastCalledNumber,
    currentWinPattern,
    playerTickets,
    winningTickets: currentWinningTickets,
    isLoadingTickets
  };
  
  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};
