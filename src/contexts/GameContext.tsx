import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePlayerTickets, PlayerTicket } from '@/hooks/playerTickets/usePlayerTickets'; 
import { usePlayerContext } from './PlayerContext';
import { useSessionContext } from './SessionProvider';
import { getNCMInstance } from '@/utils/NEWConnectionManager_SinglePointOfTruth';
import { logWithTimestamp } from '@/utils/logUtils';
import { EVENT_TYPES, CHANNEL_NAMES } from '@/constants/websocketConstants';

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
  const sessionId = player?.sessionId || currentSession?.id || null;

  // Get the NCM_SPOT instance
  const ncmSpot = getNCMInstance();

  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [currentWinPattern, setCurrentWinPattern] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<PlayerTicket | null>(null);
  const [isBingo, setIsBingo] = useState(false);
  const [winningTickets, setWinningTickets] = useState<PlayerTicket[]>([]);

  // Create a unique ID for this component instance for better debug logging
  const instanceId = React.useRef(`GameContext-${Math.random().toString(36).substring(2, 7)}`).current;

  // Use the PlayerTickets hook to fetch and manage tickets
  const { 
    playerTickets, 
    isLoadingTickets,
    ticketError,
    refreshTickets,
    isRefreshingTickets,
    updateWinningStatus
  } = usePlayerTickets(sessionId, player?.id);

  // Create a logger for this component
  const log = (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const prefix = `GameContext (${instanceId})`;
    logWithTimestamp(`${prefix}: ${message}`, level);
  };

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

  // Listen for number called updates - WITH STRICT PREREQUISITE CHECKS
  useEffect(() => {
    // STRICT PREREQUISITE CHECK: Only set up listeners if we have a valid session ID
    if (!sessionId) {
      log(`No session ID available, skipping number listener setup`, 'warn');
      return () => {};
    }

    // STRICT PREREQUISITE CHECK: NCM_SPOT must be initialized and connected
    if (!ncmSpot.isServiceInitialized() || !ncmSpot.isOverallConnected()) {
      log(`NCM_SPOT not ready (initialized: ${ncmSpot.isServiceInitialized()}, connected: ${ncmSpot.isOverallConnected()}), deferring number listener setup`, 'warn');
      return () => {};
    }

    // Construct the channel name for game updates
    const gameUpdatesChannel = `${CHANNEL_NAMES.GAME_UPDATES_BASE}${sessionId}`;

    log(`Setting up number called listener for session ${sessionId} on channel ${gameUpdatesChannel}`, 'info');
    const removeNumberListener = ncmSpot.listenForEvent(
      gameUpdatesChannel,
      EVENT_TYPES.NUMBER_CALLED, 
      (data: any) => {
        // Verify the data is for our session
        if (data?.sessionId !== sessionId) {
          log(`Ignoring number called for different session: ${data?.sessionId}`, 'info');
          return;
        }

        log(`Number called update: ${JSON.stringify(data)}`, 'info');

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
      log(`Cleaning up number called listener`, 'info');
      removeNumberListener();
    };
  }, [sessionId, currentWinPattern, updateWinningStatus, instanceId]);

  // Listen for game state updates - WITH STRICT PREREQUISITE CHECKS
  useEffect(() => {
    // STRICT PREREQUISITE CHECK: Only set up listeners if we have a valid session ID
    if (!sessionId) {
      log(`No session ID available, skipping game state listener setup`, 'warn');
      return () => {};
    }

    // STRICT PREREQUISITE CHECK: NCM_SPOT must be initialized and connected
    if (!ncmSpot.isServiceInitialized() || !ncmSpot.isOverallConnected()) {
      log(`NCM_SPOT not ready (initialized: ${ncmSpot.isServiceInitialized()}, connected: ${ncmSpot.isOverallConnected()}), deferring game state listener setup`, 'warn');
      return () => {};
    }

    // Construct the channel name for game updates
    const gameUpdatesChannel = `${CHANNEL_NAMES.GAME_UPDATES_BASE}${sessionId}`;

    log(`Setting up game state listener for session ${sessionId} on channel ${gameUpdatesChannel}`, 'info');
    const removeStateListener = ncmSpot.listenForEvent(
      gameUpdatesChannel,
      EVENT_TYPES.GAME_STATE_UPDATE,
      (gameState: any) => {
        // Verify the data is for our session
        if (gameState?.sessionId !== sessionId) {
          log(`Ignoring game state update for different session: ${gameState?.sessionId}`, 'info');
          return;
        }

        if (gameState?.currentWinPattern) {
          log(`Win pattern update: ${gameState.currentWinPattern}`, 'info');
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
      log(`Cleaning up game state listener`, 'info');
      removeStateListener();
    };
  }, [sessionId, calledNumbers, updateWinningStatus, currentWinPattern, instanceId]);

  const value: GameContextData = {
    calledNumbers,
    lastCalledNumber,
    currentWinPattern,
    playerTickets, 
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
