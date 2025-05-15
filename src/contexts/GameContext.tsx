
import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePlayerTickets, PlayerTicket } from '@/hooks/usePlayerTickets'; 
import { usePlayerContext } from './PlayerContext';
import { useSessionContext } from './SessionProvider';
import { useNetwork } from './network';

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
  const { addNumberCalledListener, addGameStateUpdateListener } = useNetwork();
  
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [currentWinPattern, setCurrentWinPattern] = useState<string | null>(null);
  
  // Use the PlayerTickets hook to fetch and manage tickets
  const { 
    playerTickets, 
    isLoadingTickets,
    updateWinningStatus,
    currentWinningTickets
  } = usePlayerTickets(player?.sessionId);
  
  // Listen for number called updates
  useEffect(() => {
    if (!player?.sessionId) return;
    
    console.log('GameContext: Setting up number called listener');
    const removeListener = addNumberCalledListener((number, allNumbers) => {
      console.log('GameContext: Number called update', { number, count: allNumbers?.length });
      
      if (number !== null) {
        setLastCalledNumber(number);
      }
      
      if (allNumbers && Array.isArray(allNumbers)) {
        setCalledNumbers(allNumbers);
        
        // Update winning status when new numbers are called
        if (currentWinPattern) {
          updateWinningStatus(allNumbers, currentWinPattern);
        }
      }
    });
    
    return removeListener;
  }, [player?.sessionId, currentWinPattern, addNumberCalledListener, updateWinningStatus]);
  
  // Listen for game state updates
  useEffect(() => {
    if (!player?.sessionId) return;
    
    console.log('GameContext: Setting up game state listener');
    const removeListener = addGameStateUpdateListener((gameState) => {
      if (gameState?.currentWinPattern) {
        console.log('GameContext: Win pattern update', gameState.currentWinPattern);
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
    });
    
    return removeListener;
  }, [player?.sessionId, calledNumbers, addGameStateUpdateListener, updateWinningStatus]);
  
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
