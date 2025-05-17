
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePlayerTickets, PlayerTicket } from '@/hooks/playerTickets/usePlayerTickets'; 
import { usePlayerContext } from './PlayerContext';
import { useSessionContext } from './SessionProvider';
import { useWebSocket } from '@/hooks/useWebSocket';
import { logWithTimestamp } from '@/utils/logUtils';
import { CHANNEL_NAMES } from '@/constants/websocketConstants';

interface GameContextData {
  calledNumbers: number[];
  lastCalledNumber: number | null;
  currentWinPattern: string | null;
  playerTickets: PlayerTicket[];
  winningTickets: PlayerTicket[];
  isLoadingTickets: boolean;
  markNumber: (ticketId: string, rowIndex: number, colIndex: number, number: number) => void;
  isBingo: boolean;
  resetBingo: () => void;
  selectedTicket: PlayerTicket | null;
  setSelectedTicket: React.Dispatch<React.SetStateAction<PlayerTicket | null>>;
}

const GameContext = createContext<GameContextData | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { player } = usePlayerContext();
  const { currentSession } = useSessionContext();
  const sessionId = player?.sessionId || null;
  
  // Only set up WebSocket when we have a valid session ID
  const { listenForEvent, EVENTS, isConnected, connectionState, isWsReady } = useWebSocket(sessionId);
  
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [currentWinPattern, setCurrentWinPattern] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<PlayerTicket | null>(null);
  const [isBingo, setIsBingo] = useState(false);
  const [winningTickets, setWinningTickets] = useState<PlayerTicket[]>([]);
  
  // Create a unique ID for this component instance
  const instanceId = React.useRef(`GameContext-${Math.random().toString(36).substring(2, 7)}`).current;
  
  // Use the PlayerTickets hook to fetch and manage tickets
  const { 
    tickets, 
    isLoading: isLoadingTickets,
    error
  } = usePlayerTickets(sessionId, player?.id);
  
  // Mark number on a ticket
  const markNumber = useCallback((ticketId: string, rowIndex: number, colIndex: number, number: number) => {
    // Implementation here - simplified for example
    console.log(`Marking number ${number} at position [${rowIndex},${colIndex}] on ticket ${ticketId}`);
    
    // In a real implementation, this would update the local state of marked positions
    // and check if this creates a bingo
  }, []);
  
  // Reset bingo state
  const resetBingo = useCallback(() => {
    setIsBingo(false);
  }, []);
  
  // Process tickets to check for winners based on called numbers and win pattern
  const updateWinningStatus = useCallback((calledNums: number[], winPattern: string | null) => {
    // This would check each ticket against the called numbers and current win pattern
    // For simplicity, we'll just log that this was called
    console.log(`Checking winning status with ${calledNums.length} called numbers and pattern ${winPattern}`);
    
    // In a real implementation, this would set winningTickets based on which tickets match the win pattern
  }, []);
  
  // Listen for number called updates
  useEffect(() => {
    // ENFORCE PREREQUISITE CHECKS: Only set up listeners if we have a valid session ID and WebSocket is ready
    if (!sessionId) {
      logWithTimestamp(`[${instanceId}] No session ID available, skipping number listener setup`, 'warn');
      return () => {};
    }
    
    // Check WebSocket readiness before setting up listeners
    if (!isWsReady) {
      logWithTimestamp(`[${instanceId}] WebSocket not ready, deferring number listener setup`, 'warn');
      return () => {};
    }
    
    // Verify that we have a valid event type
    if (!EVENTS || !EVENTS.NUMBER_CALLED) {
      logWithTimestamp(`[${instanceId}] No valid event type for NUMBER_CALLED, skipping listener setup`, 'error');
      return () => {};
    }
    
    logWithTimestamp(`[${instanceId}] Setting up number called listener for session ${sessionId}`, 'info');
    const removeNumberListener = listenForEvent(
      EVENTS.NUMBER_CALLED, 
      (data: any) => {
        // Verify the data is for our session
        if (data?.sessionId !== sessionId) {
          logWithTimestamp(`[${instanceId}] Ignoring number called for different session: ${data?.sessionId}`, 'debug');
          return;
        }
        
        logWithTimestamp(`[${instanceId}] Number called update: ${JSON.stringify(data)}`, 'info');
        
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
  }, [sessionId, currentWinPattern, listenForEvent, EVENTS, updateWinningStatus, isWsReady, instanceId]);
  
  // Listen for game state updates
  useEffect(() => {
    // ENFORCE PREREQUISITE CHECKS: Only set up listeners if we have a valid session ID and WebSocket is ready
    if (!sessionId) {
      logWithTimestamp(`[${instanceId}] No session ID available, skipping game state listener setup`, 'warn');
      return () => {};
    }
    
    // Check WebSocket readiness before setting up listeners
    if (!isWsReady) {
      logWithTimestamp(`[${instanceId}] WebSocket not ready, deferring game state listener setup`, 'warn');
      return () => {};
    }
    
    // Verify that we have a valid event type
    if (!EVENTS || !EVENTS.GAME_STATE_UPDATE) {
      logWithTimestamp(`[${instanceId}] No valid event type for GAME_STATE_UPDATE, skipping listener setup`, 'error');
      return () => {};
    }
    
    logWithTimestamp(`[${instanceId}] Setting up game state listener for session ${sessionId}`, 'info');
    const removeStateListener = listenForEvent(
      EVENTS.GAME_STATE_UPDATE,
      (gameState: any) => {
        // Verify the data is for our session
        if (gameState?.sessionId !== sessionId) {
          logWithTimestamp(`[${instanceId}] Ignoring game state update for different session: ${gameState?.sessionId}`, 'debug');
          return;
        }
        
        if (gameState?.currentWinPattern) {
          logWithTimestamp(`[${instanceId}] Win pattern update: ${gameState.currentWinPattern}`, 'info');
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
          
          // Update winning status of tickets with new called numbers and possibly new pattern
          updateWinningStatus(gameState.calledNumbers, gameState.currentWinPattern || currentWinPattern);
        }
      }
    );
    
    // Clean up when unmounting or session/connection state changes
    return () => {
      logWithTimestamp(`[${instanceId}] Cleaning up game state listener`, 'info');
      removeStateListener();
    };
  }, [sessionId, calledNumbers, listenForEvent, EVENTS, updateWinningStatus, isWsReady, instanceId]);
  
  const value: GameContextData = {
    calledNumbers,
    lastCalledNumber,
    currentWinPattern,
    playerTickets: tickets,
    winningTickets,
    isLoadingTickets,
    markNumber,
    isBingo,
    resetBingo,
    selectedTicket,
    setSelectedTicket
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
