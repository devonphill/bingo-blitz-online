import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import { usePlayerClaimManagement } from "@/hooks/usePlayerClaimManagement";
import { usePlayerWebSocketNumbers } from "@/hooks/playerWebSocket";
import BingoClaim, { claimEvents } from "./BingoClaim";
import { setupClaimDebugging } from "@/utils/claimDebugUtils";
import PlayerLobby from "./PlayerLobby";
import { ClaimStatus } from "@/types/claim";

interface PlayerGameContentProps {
  tickets: any[];
  calledNumbers?: number[];
  currentNumber?: number | null;
  currentSession?: any;
  autoMarking?: boolean;
  setAutoMarking?: (value: boolean) => void;
  playerCode?: string;
  playerName?: string;
  playerId?: string;
  winPrizes?: Record<string, string>;
  activeWinPatterns?: string[];
  onClaimBingo?: () => Promise<boolean>;
  claimStatus?: ClaimStatus;
  isClaiming?: boolean;
  gameType?: string;
  currentWinPattern?: string | null;
  currentGameNumber?: number;
  numberOfGames?: number;
  backgroundColor?: string;
  connectionState?: 'disconnected' | 'connecting' | 'connected' | 'error';
  onRefreshTickets?: () => void;
  onReconnect?: () => void;
  children?: React.ReactNode;
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
  playerId,
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
  onReconnect,
  children
}: PlayerGameContentProps) {
  // Keep a reference to track component instance
  const componentId = useRef(`playerGame-${Math.random().toString(36).substring(2, 7)}`);
  
  // Check if we should show the lobby (game is pending/setup)
  const showLobby = useMemo(() => {
    return currentSession && 
           (currentSession.status === 'pending' || 
            currentSession.lifecycle_state === 'setup' || 
            currentSession.lifecycle_state === 'lobby');
  }, [currentSession]);
  
  // Log critical values to help with debugging
  useEffect(() => {
    console.log('PlayerGameContent critical values:', {
      sessionId: currentSession?.id,
      playerCode,
      playerId,
      playerName,
      showLobby,
      sessionStatus: currentSession?.status,
      lifecycleState: currentSession?.lifecycle_state,
      claimStatus
    });
  }, [currentSession, playerCode, playerId, playerName, claimStatus, showLobby]);
  
  const { getGameTypeById } = useGameManager();
  
  // Local states for UI elements
  const [isAutoMarkingEnabled, setIsAutoMarkingEnabled] = useState(autoMarking);
  const [showDebug, setShowDebug] = useState(false);
  const [gameTypeDetails, setGameTypeDetails] = useState<any>(null);
  const [localNumbers, setLocalNumbers] = useState<number[]>(calledNumbers || []); 
  const [localCurrentNumber, setLocalCurrentNumber] = useState<number | null>(currentNumber);

  // Use the network context
  const network = useNetwork();
  
  // Use our WebSocket numbers hook for reliable number reception
  const {
    calledNumbers: wsCalledNumbers,
    lastCalledNumber: wsLastCalledNumber,
    isConnected: wsConnected
  } = usePlayerWebSocketNumbers(currentSession?.id);
  
  // Use our claim management hook with the correct number of arguments
  const {
    claimStatus: claimStatusFromHook,
    isSubmittingClaim,
    submitClaim,
    resetClaimStatus
  } = usePlayerClaimManagement(
    playerCode || null,
    playerId || null,
    currentSession?.id || null,
    playerName || null,
    gameType,
    currentWinPattern || null
  );
  
  // Map claim status types if needed
  const mapClaimStatus = (status: ClaimStatus): 'none' | 'pending' | 'valid' | 'invalid' => {
    switch (status) {
      case 'validated': return 'valid';
      case 'rejected': return 'invalid';
      case 'validating': return 'pending';
      case 'valid': return 'valid';
      case 'invalid': return 'invalid';
      case 'pending': return 'pending';
      default: return 'none';
    }
  };
  
  // Setup claim debugging - Enhanced with immediate testing
  useEffect(() => {
    logWithTimestamp(`PlayerGameContent (${componentId.current}): Setting up claim debugging`, 'info');
    const cleanup = setupClaimDebugging();
    
    // After a short delay, test the drawer visibility
    setTimeout(() => {
      if (typeof window !== 'undefined' && (window as any).debugClaims) {
        logWithTimestamp(`PlayerGameContent: Testing claim drawer visibility`, 'info');
        (window as any).debugClaims.showTestToast("Claim system initialized - click to test");
      }
    }, 2000);
    
    return cleanup;
  }, []);

  // Use the WebSocket called numbers if available, otherwise use props
  const effectiveCalledNumbers = wsCalledNumbers.length > 0 ? wsCalledNumbers : calledNumbers;
  const effectiveLastCalledNumber = wsLastCalledNumber !== null ? wsLastCalledNumber : currentNumber;
  
  // Use claim status from hook if available, otherwise use props
  const effectiveClaimStatus = claimStatusFromHook || claimStatus;
  const effectiveIsClaiming = isSubmittingClaim || isClaiming;

  // Load game type details
  useEffect(() => {
    if (gameType) {
      const details = getGameTypeById(gameType);
      if (details) {
        setGameTypeDetails(details);
      }
    }
  }, [gameType, getGameTypeById]);

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
      // Initialize connection with proper method chaining
      connectionManager.init(currentSession.id)
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

  // Handle local claim bingo
  const handleLocalClaimBingo = async () => {
    logWithTimestamp(`PlayerGameContent (${componentId.current}): Handling local claim bingo`, 'info');
    
    if (onClaimBingo) {
      // Use the provided claim handler from props
      return await onClaimBingo();
    } 
    else if (submitClaim && tickets && tickets.length > 0) {
      // Use the claim manager hook if we have ticket data
      return await submitClaim(tickets[0]);
    }
    
    return false;
  };
  
  // If the game is in pending/setup state, show the lobby
  if (showLobby) {
    return (
      <PlayerLobby
        sessionName={currentSession?.name}
        playerName={playerName}
        sessionId={currentSession?.id}
        onRefreshStatus={onRefreshTickets}
        errorMessage={null}
      />
    );
  }
  
  // Map claim status for display where needed
  const displayClaimStatus = mapClaimStatus(effectiveClaimStatus as ClaimStatus);
  
  return (
    <div className="min-h-full flex flex-col" style={{ backgroundColor }}>
      <GameHeader 
        gameNumber={currentGameNumber} 
        totalGames={numberOfGames}
        pattern={effectivePatternDisplay || 'Not set'}
        prize={effectivePrize || 'Prize to be announced'}
        claimStatus={displayClaimStatus}
        isClaiming={effectiveIsClaiming}
        onClaimBingo={handleLocalClaimBingo}
      />
      
      <div className="flex-grow overflow-y-auto">
        <div className="container mx-auto px-4 py-6">
          <StatusBar
            playerName={playerName}
            currentNumber={effectiveLastCalledNumber}
            calledNumbers={effectiveCalledNumbers}
            gameType={gameType}
            showAutoMarkToggle={true}
            autoMarkEnabled={autoMarking}
            onToggleAutoMark={toggleAutoMarking}
            connectionState={wsConnected ? 'connected' : connectionState}
          />
          
          <div className="mt-4">
            {children || (
              <GameTypePlayspace
                gameType={gameType as any}
                tickets={tickets}
                calledNumbers={effectiveCalledNumbers}
                lastCalledNumber={effectiveLastCalledNumber}
                autoMarking={autoMarking}
                setAutoMarking={setAutoMarking}
                handleClaimBingo={handleLocalClaimBingo}
                isClaiming={effectiveIsClaiming}
                claimStatus={effectiveClaimStatus === 'valid' ? 'validated' : effectiveClaimStatus === 'invalid' ? 'rejected' : 'pending'}
                sessionId={currentSession?.id}
                playerId={playerId}
                playerName={playerName}
              />
            )}
          </div>
        </div>
      </div>
      
      <GameSheetControls
        onClaimBingo={handleLocalClaimBingo}
        claimStatus={displayClaimStatus}
        isClaiming={effectiveIsClaiming}
        onRefreshTickets={onRefreshTickets}
        sessionId={currentSession?.id}
        playerId={playerId}
      />
      
      {/* Use our portal-based claim notification system */}
      <BingoClaim
        onClaimBingo={handleLocalClaimBingo}
        claimStatus={displayClaimStatus}
        isClaiming={effectiveIsClaiming}
        resetClaimStatus={resetClaimStatus}
        playerName={playerName}
        currentTicket={tickets && tickets.length > 0 ? tickets[0] : null}
        calledNumbers={effectiveCalledNumbers}
        sessionId={currentSession?.id}
        playerId={playerId}
      />
      
      {showDebug && (
        <div className="fixed bottom-4 right-4 w-64">
          <DebugPanel 
            playerCode={playerCode}
            sessionId={currentSession?.id}
            gameType={gameType}
            calledNumbers={effectiveCalledNumbers}
            lastCalledNumber={effectiveLastCalledNumber}
            connectionState={wsConnected ? 'connected' : network.connectionState || connectionState}
            onReconnect={onReconnect}
          />
        </div>
      )}
    </div>
  );
}
