
import React, { useEffect, useState, useCallback, useMemo } from "react";
import GameHeader from "./GameHeader";
import BingoCardGrid from "./BingoCardGrid";
import StatusBar from "./StatusBar";
import GameSheetControls from "./GameSheetControls";
import DebugPanel from "./DebugPanel";
import { connectionManager } from "@/utils/connectionManager";
import { logWithTimestamp } from "@/utils/logUtils";
import { useNetwork } from "@/contexts/NetworkStatusContext";
import { useGameManager } from "@/contexts/GameManager";
import GameTypePlayspace from "./GameTypePlayspace";

interface PlayerGameContentProps {
  tickets: any[];
  calledNumbers?: number[];
  currentNumber?: number | null;
  currentSession?: any;
  autoMarking?: boolean;
  setAutoMarking?: (value: boolean) => void;
  playerCode?: string;
  playerName?: string;
  winPrizes?: Record<string, string>;
  activeWinPatterns?: string[];
  onClaimBingo?: () => Promise<boolean>;
  claimStatus?: 'none' | 'pending' | 'valid' | 'invalid';
  isClaiming?: boolean;
  gameType?: string;
  currentWinPattern?: string | null;
  currentGameNumber?: number;
  numberOfGames?: number;
  backgroundColor?: string;
  connectionState?: 'disconnected' | 'connecting' | 'connected' | 'error';
  onRefreshTickets?: () => void;
  onReconnect?: () => void;
}

export default function PlayerGameContent({
  tickets = [],
  calledNumbers = [],
  currentNumber = null,
  currentSession,
  autoMarking = true,
  setAutoMarking,
  playerCode,
  playerName,
  winPrizes = {},
  activeWinPatterns = [],
  onClaimBingo,
  claimStatus = 'none',
  isClaiming = false,
  gameType = 'mainstage',
  currentWinPattern = null,
  currentGameNumber = 1,
  numberOfGames = 1,
  backgroundColor = 'transparent',
  connectionState = 'connected',
  onRefreshTickets,
  onReconnect
}: PlayerGameContentProps) {
  const { getGameTypeById } = useGameManager();
  // Local states for UI elements
  const [isAutoMarkingEnabled, setIsAutoMarkingEnabled] = useState(autoMarking);
  const [showDebug, setShowDebug] = useState(false);
  const [localNumbers, setLocalNumbers] = useState<number[]>(calledNumbers);
  const [localCurrentNumber, setLocalCurrentNumber] = useState<number | null>(currentNumber);
  const [gameTypeDetails, setGameTypeDetails] = useState<any>(null);

  // Load game type details
  useEffect(() => {
    if (gameType) {
      const details = getGameTypeById(gameType);
      if (details) {
        setGameTypeDetails(details);
      }
    }
  }, [gameType, getGameTypeById]);

  // Use the network context
  const network = useNetwork();

  // Handle changes to external props
  useEffect(() => {
    if (calledNumbers && calledNumbers.length > 0) {
      setLocalNumbers(calledNumbers);
    }
  }, [calledNumbers]);

  useEffect(() => {
    setLocalCurrentNumber(currentNumber);
  }, [currentNumber]);

  useEffect(() => {
    setIsAutoMarkingEnabled(autoMarking);
  }, [autoMarking]);

  // Toggle automarking (in local state and parent state if available)
  const toggleAutoMarking = useCallback(() => {
    const newValue = !isAutoMarkingEnabled;
    setIsAutoMarkingEnabled(newValue);
    
    if (setAutoMarking) {
      setAutoMarking(newValue);
    }
    
    // Store preference in localStorage
    localStorage.setItem('autoMarking', newValue.toString());
  }, [isAutoMarkingEnabled, setAutoMarking]);

  // Handle the key sequence to toggle debug panel
  useEffect(() => {
    const keySequence: string[] = [];
    const targetSequence = 'debugon';
    
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      
      keySequence.push(key);
      if (keySequence.length > targetSequence.length) {
        keySequence.shift();
      }
      
      if (keySequence.join('') === targetSequence) {
        setShowDebug(true);
      }
      
      if (keySequence.join('') === 'debugoff') {
        setShowDebug(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Initialize connection when we have a session
  useEffect(() => {
    if (!currentSession || !currentSession.id) {
      logWithTimestamp('No session available for connection', 'warn');
      return;
    }
    
    try {
      // Initialize connection once
      connectionManager.initialize(currentSession.id)
        .onNumberCalled((number, allNumbers) => {
          if (number === null) {
            // Handle reset event
            setLocalNumbers([]);
            setLocalCurrentNumber(null);
            return;
          }
          
          logWithTimestamp(`Received number call: ${number}`, 'info');
          
          // Update our local state with the new number
          setLocalCurrentNumber(number);
          
          // Add to called numbers if not already present
          setLocalNumbers(prev => {
            if (prev.includes(number)) return prev;
            return [...prev, number];
          });
        })
        // Add session progress update listener
        .onSessionProgressUpdate((progress) => {
          // This method just returns this for method chaining, it doesn't need to do anything
          if (progress) {
            // Could handle progress updates here if needed
            logWithTimestamp('Received session progress update', 'debug');
          }
        });
    } catch (error) {
      logWithTimestamp(`Error initializing connection: ${error}`, 'error');
    }
  }, [currentSession]);

  // Derive pattern-related data for display
  const {
    effectivePattern, 
    effectivePrize,
    effectivePatternDisplay
  } = useMemo(() => {
    const pattern = currentWinPattern || (activeWinPatterns && activeWinPatterns.length > 0 ? activeWinPatterns[0] : 'oneLine');
    
    // Map pattern IDs to display names
    let patternDisplay = pattern;
    switch (pattern) {
      case 'oneLine': patternDisplay = 'One Line'; break;
      case 'twoLines': patternDisplay = 'Two Lines'; break;
      case 'fullHouse': patternDisplay = 'Full House'; break;
      case 'fourCorners': patternDisplay = 'Four Corners'; break;
      case 'centerSquare': patternDisplay = 'Center Square'; break;
      default: patternDisplay = pattern?.charAt(0).toUpperCase() + pattern?.slice(1) || 'One Line';
    }
    
    return {
      effectivePattern: pattern,
      effectivePrize: winPrizes && pattern ? winPrizes[pattern] || 'Prize' : 'Prize',
      effectivePatternDisplay: patternDisplay
    };
  }, [currentWinPattern, activeWinPatterns, winPrizes]);

  return (
    <div className={`min-h-full flex flex-col`} style={{ backgroundColor }}>
      <GameHeader 
        gameNumber={currentGameNumber} 
        totalGames={numberOfGames}
        pattern={effectivePatternDisplay || 'Not set'}
        prize={effectivePrize || 'Prize to be announced'}
        claimStatus={claimStatus}
        isClaiming={isClaiming}
        onClaimBingo={onClaimBingo}
      />
      
      <div className="flex-grow overflow-y-auto">
        <div className="container mx-auto px-4 py-6">
          <StatusBar
            playerName={playerName}
            currentNumber={localCurrentNumber}
            calledNumbers={localNumbers}
            gameType={gameType}
            showAutoMarkToggle={true}
            autoMarkEnabled={isAutoMarkingEnabled}
            onToggleAutoMark={toggleAutoMarking}
            connectionState={connectionState}
          />
          
          <div className="mt-4">
            <GameTypePlayspace
              gameType={gameType}
              tickets={tickets}
              calledNumbers={localNumbers}
              lastCalledNumber={localCurrentNumber}
              autoMarking={isAutoMarkingEnabled}
              handleClaimBingo={onClaimBingo}
              isClaiming={isClaiming}
              claimStatus={claimStatus === 'valid' ? 'validated' : claimStatus === 'invalid' ? 'rejected' : 'pending'}
            />
          </div>
        </div>
      </div>
      
      <GameSheetControls
        onClaimBingo={onClaimBingo}
        claimStatus={claimStatus}
        isClaiming={isClaiming}
        onRefreshTickets={onRefreshTickets}
      />
      
      {showDebug && (
        <div className="fixed bottom-4 right-4 w-64">
          <DebugPanel 
            playerCode={playerCode}
            sessionId={currentSession?.id}
            gameType={gameType}
            calledNumbers={localNumbers}
            lastCalledNumber={localCurrentNumber}
            connectionState={network.connectionState || connectionState}
            onReconnect={onReconnect}
          />
        </div>
      )}
    </div>
  );
}
