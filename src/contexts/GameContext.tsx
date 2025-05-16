
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
  const { listenForEvent, EVENTS, isConnected } = useWebSocket(sessionId);
  
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [currentWinPattern, setCurrentWinPattern] = useState<string | null>(null);
  
  // Use the PlayerTickets hook to fetch and manage tickets
  const { 
    playerTickets, 
    isLoadingTickets,
    updateWinningStatus,
    currentWinningTickets
  } = usePlayerTickets(sessionId);
  
  // Listen for number called updates
  useEffect(() => {
    // Only set up listeners if we have a valid session ID
    if (!sessionId) {
      logWithTimestamp('GameContext: No session ID available, skipping listener setup', 'warn');
      return;
    }
    
    logWithTimestamp('GameContext: Setting up number called listener', 'info');
    const removeNumberListener = listenForEvent(
      EVENTS.NUMBER_CALLED, 
      (data: any) => {
        logWithTimestamp('GameContext: Number called update', { number: data.number, count: data.calledNumbers?.length });
        
        if (data.number !== null) {
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
    
    // Clean up when unmounting or session changes - only remove this specific listener
    return () => {
      logWithTimestamp('GameContext: Cleaning up number called listener', 'info');
      removeNumberListener();
    };
  }, [sessionId, currentWinPattern, listenForEvent, EVENTS, updateWinningStatus]);
  
  // Listen for game state updates
  useEffect(() => {
    // Only set up listeners if we have a valid session ID
    if (!sessionId) {
      logWithTimestamp('GameContext: No session ID available, skipping game state listener setup', 'warn');
      return;
    }
    
    logWithTimestamp('GameContext: Setting up game state listener', 'info');
    const removeStateListener = listenForEvent(
      EVENTS.GAME_STATE_UPDATE,
      (gameState: any) => {
        if (gameState?.currentWinPattern) {
          logWithTimestamp('GameContext: Win pattern update', gameState.currentWinPattern);
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
    
    // Clean up when unmounting or session changes - only remove this specific listener
    return () => {
      logWithTimestamp('GameContext: Cleaning up game state listener', 'info');
      removeStateListener();
    };
  }, [sessionId, calledNumbers, listenForEvent, EVENTS, updateWinningStatus]);
  
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
