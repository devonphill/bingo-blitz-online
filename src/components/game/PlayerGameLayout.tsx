import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CurrentNumberDisplay from "./CurrentNumberDisplay";
import { GameType, Ticket } from "@/types";

interface PlayerGameLayoutProps {
  tickets: any[];
  calledNumbers: number[];
  currentNumber: number | null;
  currentSession: any;
  autoMarking: boolean;
  setAutoMarking: (value: boolean) => void;
  playerCode: string;
  winPrizes: { [key: string]: string };
  activeWinPatterns: string[];
  currentWinPattern: string | null;
  onClaimBingo: (ticketInfo: Ticket) => Promise<boolean>;
  errorMessage: string;
  isLoading: boolean;
  children: React.ReactNode;
  isClaiming?: boolean;
  claimStatus?: 'pending' | 'validated' | 'rejected';
  gameType?: GameType;
  currentGameNumber?: number;
  numberOfGames?: number;
}

export default function PlayerGameLayout({
  currentSession,
  autoMarking,
  setAutoMarking,
  playerCode,
  currentWinPattern,
  winPrizes,
  onClaimBingo,
  errorMessage,
  isLoading,
  children,
  currentNumber,
  calledNumbers,
  isClaiming = false,
  claimStatus,
  gameType = 'mainstage',
  currentGameNumber = 1,
  numberOfGames = 1,
  tickets
}: PlayerGameLayoutProps) {
  const [localClaimValidating, setLocalClaimValidating] = useState(false);
  const [localClaimStatus, setLocalClaimStatus] = useState<'pending' | 'validated' | 'rejected' | null>(null);
  const [lastWinPattern, setLastWinPattern] = useState<string | null>(null);
  const [localCalledNumbers, setLocalCalledNumbers] = useState<number[]>(calledNumbers || []);
  const [localCurrentNumber, setLocalCurrentNumber] = useState<number | null>(currentNumber);
  const [prizeInfo, setPrizeInfo] = useState<any>(null);
  const { toast } = useToast();
  const instanceId = useRef(Date.now());
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTimestamp = useRef<number>(0);

  useEffect(() => {
    console.log(`PlayerGameLayout rendered with instance ID: ${instanceId.current}, pattern: ${currentWinPattern}`);
  }, [currentWinPattern]);

  useEffect(() => {
    setLocalCalledNumbers(calledNumbers || []);
    setLocalCurrentNumber(currentNumber);
  }, [calledNumbers, currentNumber]);

  useEffect(() => {
    if (currentWinPattern && currentWinPattern !== lastWinPattern) {
      console.log(`Win pattern changed from ${lastWinPattern} to ${currentWinPattern}, resetting claim status`);
      setLocalClaimStatus(null);
      setLocalClaimValidating(false);
      setLastWinPattern(currentWinPattern);
      
      if (lastWinPattern) {
        const patternName = getPatternDisplayName(currentWinPattern);
        toast({
          title: "Pattern Changed",
          description: `New pattern: ${patternName}`,
        });
      }
    }
  }, [currentWinPattern, lastWinPattern, toast]);

  const getPatternDisplayName = (pattern: string): string => {
    switch(pattern.replace('MAINSTAGE_', '')) {
      case 'oneLine': return 'One Line';
      case 'twoLines': return 'Two Lines';
      case 'fullHouse': return 'Full House';
      case 'pattern': return 'Pattern';
      case 'blackout': return 'Blackout';
      default: return pattern;
    }
  };

  useEffect(() => {
    if (!currentSession?.id) return;
    
    console.log(`Setting up real-time number listener for session ${currentSession.id}`);
    
    const numberChannel = supabase
      .channel('number-updates')
      .on(
        'broadcast',
        { event: 'number-called' },
        (payload) => {
          console.log("Received number broadcast:", payload);
          
          if (payload.payload && payload.payload.sessionId === currentSession.id) {
            const { lastCalledNumber, calledNumbers, activeWinPattern, prizeInfo, timestamp } = payload.payload;
            
            if (!timestamp || timestamp <= lastUpdateTimestamp.current) {
              console.log(`Ignoring outdated or duplicate update with timestamp: ${timestamp}`);
              return;
            }
            
            console.log(`Processing new update with timestamp: ${timestamp}`);
            lastUpdateTimestamp.current = timestamp;
            
            console.log(`Updating numbers: Last=${lastCalledNumber}, Total=${calledNumbers?.length}`);
            
            if (lastCalledNumber !== null && lastCalledNumber !== undefined) {
              setLocalCurrentNumber(lastCalledNumber);
              
              toast({
                title: "New Number Called",
                description: `Number ${lastCalledNumber} has been called`,
                duration: 3000,
              });
            }
            
            if (calledNumbers && Array.isArray(calledNumbers)) {
              setLocalCalledNumbers(calledNumbers);
            }
            
            if (prizeInfo) {
              setPrizeInfo(prizeInfo);
            }
            
            if (activeWinPattern && activeWinPattern !== currentWinPattern) {
              setLastWinPattern(currentWinPattern);
              
              const patternName = getPatternDisplayName(activeWinPattern);
              toast({
                title: "Pattern Changed",
                description: `New pattern: ${patternName}`,
                duration: 5000,
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("Number updates subscription status:", status);
      });
    
    return () => {
      console.log("Unsubscribing from number updates channel");
      supabase.removeChannel(numberChannel);
    };
  }, [currentSession?.id, toast, currentWinPattern]);

  useEffect(() => {
    if (claimStatus !== undefined) {
      setLocalClaimStatus(claimStatus);
    }
    
    if (claimStatus === 'validated' || claimStatus === 'rejected') {
      setLocalClaimValidating(false);
    }
    
    if (isClaiming === false) {
      setLocalClaimValidating(false);
    }
  }, [claimStatus, isClaiming]);

  useEffect(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    
    if (localClaimStatus === 'validated' || localClaimStatus === 'rejected') {
      console.log(`Setting up auto-reset for claim status: ${localClaimStatus}`);
      
      resetTimerRef.current = setTimeout(() => {
        console.log(`Auto-resetting claim status from ${localClaimStatus}`);
        setLocalClaimStatus(null);
      }, 5000);
    }
    
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, [localClaimStatus]);

  useEffect(() => {
    if (!currentSession?.id || !playerCode) return;
    
    console.log(`Setting up claim result broadcast listener for player (instance ${instanceId.current})`);
    
    const claimsChannel = supabase
      .channel(`player-claims-listener-${instanceId.current}`)
      .on(
        'broadcast',
        { event: 'claim-result' },
        (payload) => {
          console.log("Received claim result broadcast:", payload);
          
          if (payload.payload && payload.payload.playerId === playerCode) {
            const result = payload.payload.result;
            
            if (result === 'valid' || result === 'rejected') {
              setLocalClaimValidating(false);
              setLocalClaimStatus(result === 'valid' ? 'validated' : 'rejected');
              
              toast({
                title: result === 'valid' ? "Claim Verified!" : "Claim Rejected",
                description: result === 'valid' 
                  ? "Your bingo claim has been verified." 
                  : "Your claim was not valid. Please check your numbers.",
                variant: result === 'valid' ? "default" : "destructive"
              });
            }
          }
        }
      )
      .subscribe();
      
    const gameUpdatesChannel = supabase
      .channel(`player-game-updates-${instanceId.current}`)
      .on(
        'broadcast',
        { event: 'claim-update' },
        (payload) => {
          console.log(`Instance ${instanceId.current} received claim update broadcast:`, payload);
          if (payload.payload && payload.payload.sessionId === currentSession.id && 
              payload.payload.result === 'valid') {
            setLocalClaimStatus('validated');
            setLocalClaimValidating(false);
          } else if (payload.payload && payload.payload.sessionId === currentSession.id && 
              payload.payload.result === 'false') {
            setLocalClaimStatus('rejected');
            setLocalClaimValidating(false);
          }
          
          if (payload.payload && 
              payload.payload.sessionId === currentSession.id && 
              payload.payload.patternChange === true) {
            console.log(`Instance ${instanceId.current}: Pattern changed, resetting claim status`);
            setLocalClaimStatus(null);
            setLocalClaimValidating(false);
            
            if (payload.payload.nextPattern && payload.payload.nextPattern !== lastWinPattern) {
              setLastWinPattern(null);
            }
            
            if (payload.payload.nextPattern) {
              const patternName = getPatternDisplayName(payload.payload.nextPattern);
              console.log(`Pattern changed to: ${patternName}`);
            }
          }
        }
      )
      .subscribe();
    
    const progressChannel = supabase
      .channel(`game-progression-channel-${instanceId.current}`)
      .on(
        'broadcast',
        { event: 'game-progression' },
        (payload) => {
          console.log(`Instance ${instanceId.current} received game progression broadcast:`, payload);
          
          if (payload.payload && payload.payload.sessionId === currentSession.id) {
            console.log("Game progressed, resetting claim status");
            setLocalClaimStatus(null);
            setLocalClaimValidating(false);
            setLastWinPattern(null);
            
            if (payload.payload.previousGame !== payload.payload.newGame) {
              toast({
                title: "New Game",
                description: `Game ${payload.payload.newGame} has started!`,
              });
            } else {
              const pattern = payload.payload.nextPattern || 
                (currentWinPattern === 'oneLine' ? 'twoLines' : 
                 currentWinPattern === 'twoLines' ? 'fullHouse' : 'fullHouse');
              
              const patternName = getPatternDisplayName(pattern);
              toast({
                title: "Pattern Changed",
                description: `New pattern: ${patternName}`,
              });
            }
          }
        }
      )
      .subscribe();
    
    return () => {
      console.log(`Cleaning up broadcast channels for instance ${instanceId.current}`);
      supabase.removeChannel(claimsChannel);
      supabase.removeChannel(gameUpdatesChannel);
      supabase.removeChannel(progressChannel);
    };
  }, [currentSession?.id, playerCode, toast, lastWinPattern, currentWinPattern, instanceId]);

  const handleClaimClick = async () => {
    if (localClaimValidating || isClaiming || localClaimStatus === 'validated' || !tickets || tickets.length === 0) {
      console.log("Claim already in progress, validated, or no tickets, ignoring click");
      return;
    }
    
    try {
      console.log("Attempting to claim bingo");
      setLocalClaimValidating(true);
      const success = await onClaimBingo(tickets[0]);
      
      if (!success) {
        setLocalClaimValidating(false);
        toast({
          title: "Claim Failed",
          description: "Unable to submit your claim. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error submitting claim:", error);
      setLocalClaimValidating(false);
      
      toast({
        title: "Error",
        description: "There was a problem submitting your claim. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getPrizeDisplay = () => {
    if (prizeInfo) {
      return prizeInfo.isNonCash 
        ? prizeInfo.description 
        : `£${prizeInfo.amount}`;
    }
    
    if (currentWinPattern && winPrizes && winPrizes[currentWinPattern]) {
      const prizeValue = winPrizes[currentWinPattern];
      return `£${prizeValue}`;
    }
    
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading game...</h2>
        </div>
      </div>
    );
  }
  
  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white shadow-lg rounded-lg p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
          <p className="text-gray-700 mb-6">{errorMessage}</p>
          <div className="flex justify-center">
            <Button onClick={() => window.location.href = '/join'}>
              Join a Different Game
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  if (!currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Waiting for game to start</h2>
          <p className="text-gray-600 mb-4">The caller has not started the game yet.</p>
          <Button onClick={() => window.location.href = '/join'}>
            Join a Different Game
          </Button>
        </div>
      </div>
    );
  }
  
  const isClaimInProgress = localClaimValidating || isClaiming || localClaimStatus === 'pending';
  const isClaimValidated = localClaimStatus === 'validated' || claimStatus === 'validated';
  
  const currentWinPatternDisplay = currentWinPattern ? getPatternDisplayName(currentWinPattern) : 'None';
  const prizeDisplay = getPrizeDisplay();
  
  return (
    <div className="min-h-screen w-full flex bg-gray-50">
      <div className="flex flex-col" style={{width:'30%', minWidth:240, maxWidth:400}}>
        <div className="flex-1 bg-black text-white p-4">
          <h1 className="text-xl font-bold mb-4">Bingo Game Info</h1>
          {gameType && (
            <div className="mb-4 p-2 bg-gray-800 rounded">
              <p className="text-sm text-gray-300">
                Game Type: <span className="font-bold text-white">{gameType}</span>
              </p>
              {numberOfGames > 1 && (
                <p className="text-sm text-gray-300 mt-1">
                  Game: <span className="font-bold text-white">{currentGameNumber} of {numberOfGames}</span>
                </p>
              )}
            </div>
          )}
          <Button
            className={`w-full ${isClaimInProgress
              ? 'bg-orange-500 hover:bg-orange-600' 
              : isClaimValidated
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary'
            }`}
            onClick={handleClaimClick}
            disabled={isClaimInProgress || isClaimValidated}
          >
            {isClaimInProgress ? (
              <span className="flex items-center">
                <Loader className="animate-spin mr-2 h-4 w-4" />
                VALIDATING CLAIM...
              </span>
            ) : isClaimValidated ? 
              "CLAIM VALIDATED!" : 
              "CLAIM NOW!"}
          </Button>
          
          {isClaimInProgress && (
            <p className="text-xs text-gray-300 mt-2 text-center">
              Your claim is being verified. Please wait...
            </p>
          )}
          
          {currentWinPattern && (
            <div className="mt-4 p-2 bg-gray-800 rounded">
              <p className="text-sm text-gray-300">
                Current Win Pattern: <span className="font-bold text-white">{currentWinPatternDisplay}</span>
              </p>
              {prizeDisplay && (
                <p className="text-sm text-gray-300 mt-1">
                  Prize: <span className="font-bold text-white">{prizeDisplay}</span>
                </p>
              )}
              {prizeInfo && prizeInfo.description && (
                <p className="text-sm text-gray-300 mt-1">
                  Description: <span className="font-bold text-white">{prizeInfo.description}</span>
                </p>
              )}
            </div>
          )}
        </div>
        
        <div className="bg-black text-white p-4 border-t border-gray-700 sticky bottom-0" style={{ height: '30vw', maxHeight: '400px' }}>
          <CurrentNumberDisplay number={localCurrentNumber} sizePx={Math.min(window.innerWidth * 0.25, 350)} gameType={gameType} />
          <div className="text-xs text-gray-400 mt-2 text-center">
            {localCalledNumbers.length} numbers called
          </div>
        </div>
      </div>
      <div className="flex-1 bg-gray-50 h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
