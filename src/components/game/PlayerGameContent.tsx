import React, { useEffect, useState, useCallback, useMemo } from "react";
import GameHeader from "./GameHeader";
import BingoCardGrid from "./BingoCardGrid";
import StatusBar from "./StatusBar";
import GameSheetControls from "./GameSheetControls";
import DebugPanel from "./DebugPanel";
import { connectionManager } from "@/utils/connectionManager";
import { logWithTimestamp, showEmergencyNotification } from "@/utils/logUtils";
import { useNetwork } from "@/contexts/NetworkStatusContext";
import { useGameManager } from "@/contexts/GameManager";
import GameTypePlayspace from "./GameTypePlayspace";
import { usePlayerClaimManagement } from "@/hooks/usePlayerClaimManagement";
import { usePlayerWebSocketNumbers } from "@/hooks/usePlayerWebSocketNumbers";
import BingoClaim, { claimEvents } from "./BingoClaim";

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
  children?: React.ReactNode; // Added children prop
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
  children // Added children to destructuring
}: PlayerGameContentProps) {
  const { getGameTypeById } = useGameManager();
  
  // Local states for UI elements
  const [isAutoMarkingEnabled, setIsAutoMarkingEnabled] = useState(autoMarking);
  const [showDebug, setShowDebug] = useState(false);
  const [gameTypeDetails, setGameTypeDetails] = useState<any>(null);
  const [localNumbers, setLocalNumbers] = useState<number[]>(calledNumbers || []); 
  const [localCurrentNumber, setLocalCurrentNumber] = useState<number | null>(currentNumber);

  // Add a direct claim state
  const [directClaimData, setDirectClaimData] = useState<any>(null);
  const [showDirectClaim, setShowDirectClaim] = useState(false);
  
  // Use the network context
  const network = useNetwork();
  
  // Use our WebSocket numbers hook for reliable number reception
  const {
    calledNumbers: wsCalledNumbers,
    lastCalledNumber: wsLastCalledNumber,
    isConnected: wsConnected
  } = usePlayerWebSocketNumbers(currentSession?.id);
  
  // Use our new claim management hook
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
    currentWinPattern || null,
    currentGameNumber
  );
  
  // DEBUGGING: Log important values related to claim management
  console.log('PlayerGameContent critical values:', {
    sessionId: currentSession?.id,
    playerCode,
    playerId,
    playerName,
    claimStatus: claimStatusFromHook || claimStatus
  });
  
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

  // Handle claim bingo
  const handleLocalClaimBingo = async () => {
    logWithTimestamp('PlayerGameContent: Handling local claim bingo', 'info');
    console.log('HANDLING CLAIM BINGO CLICK');
    
    if (onClaimBingo) {
      return await onClaimBingo();
    }
    return false;
  };

  // Add direct listener for claim events (redundant pathway for robustness)
  useEffect(() => {
    if (!currentSession?.id) return;
    
    logWithTimestamp('PlayerGameContent: Setting up direct claim event listener', 'info');
    
    // Subscribe to global claim events
    const removeListener = claimEvents.addListener((event) => {
      if (event.type === 'claim-checking') {
        logWithTimestamp('PlayerGameContent: Received claim checking event via event system', 'info');
        setDirectClaimData(event.data);
        setShowDirectClaim(true);
      }
      else if (event.type === 'claim-result') {
        logWithTimestamp('PlayerGameContent: Received claim result event via event system', 'info');
        setShowDirectClaim(false);
        
        // Show an emergency notification as fallback
        const isValid = event.data.result === 'valid';
        showEmergencyNotification(
          isValid 
            ? `${event.data.playerName || 'A player'} WON Bingo!` 
            : `Claim by ${event.data.playerName || 'a player'} was rejected`,
          isValid ? 'info' : 'warning'
        );
      }
    });
    
    // Listen for direct broadcast channel events as a fallback
    const checkingChannel = supabase
      .channel('claim_checking_broadcaster')
      .on('broadcast', { event: 'claim-checking' }, payload => {
        logWithTimestamp(`PlayerGameContent: Direct claim checking broadcast received`, 'info');
        
        if (payload.payload?.sessionId === currentSession.id) {
          setDirectClaimData(payload.payload);
          setShowDirectClaim(true);
          
          // Create a direct DOM notification as ultimate fallback
          const playerName = payload.payload.playerName || 'A player';
          showEmergencyNotification(`${playerName} has claimed Bingo!`, 'info');
        }
      })
      .subscribe();
    
    return () => {
      removeListener();
      if (checkingChannel) supabase.removeChannel(checkingChannel);
    };
  }, [currentSession?.id]);
  
  return (
    <div className={`min-h-full flex flex-col`} style={{ backgroundColor }}>
      <GameHeader 
        gameNumber={currentGameNumber} 
        totalGames={numberOfGames}
        pattern={effectivePatternDisplay || 'Not set'}
        prize={effectivePrize || 'Prize to be announced'}
        claimStatus={effectiveClaimStatus}
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
        claimStatus={effectiveClaimStatus}
        isClaiming={effectiveIsClaiming}
        onRefreshTickets={onRefreshTickets}
        sessionId={currentSession?.id}
        playerId={playerId}
      />
      
      {/* Add BingoClaim component for handling claim broadcasts */}
      <BingoClaim
        onClaimBingo={handleLocalClaimBingo}
        claimStatus={effectiveClaimStatus}
        isClaiming={effectiveIsClaiming}
        resetClaimStatus={resetClaimStatus}
        playerName={playerName}
        currentTicket={tickets && tickets.length > 0 ? tickets[0] : null}
        calledNumbers={effectiveCalledNumbers}
        sessionId={currentSession?.id}
        playerId={playerId}
      />
      
      {/* Direct claim display - redundant pathway for robustness */}
      {showDirectClaim && directClaimData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[20000]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2 text-center">
              {directClaimData.playerName || 'A player'} claimed Bingo!
            </h3>
            <p className="text-center text-gray-600 mb-4">
              The caller is checking this claim now...
            </p>
            <button 
              onClick={() => setShowDirectClaim(false)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
      
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
