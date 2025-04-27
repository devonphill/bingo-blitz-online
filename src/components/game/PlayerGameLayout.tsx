
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CurrentNumberDisplay from "./CurrentNumberDisplay";

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
  onClaimBingo: () => Promise<boolean>;
  errorMessage: string;
  isLoading: boolean;
  children: React.ReactNode;
  isClaiming?: boolean;
  claimStatus?: 'pending' | 'validated' | 'rejected';
  gameType?: string;
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
  numberOfGames = 1
}: PlayerGameLayoutProps) {
  const [localClaimValidating, setLocalClaimValidating] = useState(false);
  const [localClaimStatus, setLocalClaimStatus] = useState<'pending' | 'validated' | 'rejected' | null>(null);
  const [lastWinPattern, setLastWinPattern] = useState<string | null>(null);
  const { toast } = useToast();

  // Track pattern changes to manage claim status
  useEffect(() => {
    if (currentWinPattern && currentWinPattern !== lastWinPattern) {
      console.log(`Win pattern changed from ${lastWinPattern} to ${currentWinPattern}, resetting claim status`);
      setLocalClaimStatus(null);
      setLocalClaimValidating(false);
      setLastWinPattern(currentWinPattern);
      
      // Show toast when pattern changes
      if (lastWinPattern) {
        const patternName = getPatternDisplayName(currentWinPattern);
        toast({
          title: "Pattern Changed",
          description: `New pattern: ${patternName}`,
        });
      }
    }
  }, [currentWinPattern, lastWinPattern, toast]);

  // Helper function to get display name for patterns
  const getPatternDisplayName = (pattern: string): string => {
    switch(pattern) {
      case 'oneLine': return 'One Line';
      case 'twoLines': return 'Two Lines';
      case 'fullHouse': return 'Full House';
      case 'pattern': return 'Pattern';
      case 'blackout': return 'Blackout';
      default: return pattern;
    }
  };

  // Sync external claim status with local state
  useEffect(() => {
    if (claimStatus) {
      setLocalClaimStatus(claimStatus);
    }
    
    if (claimStatus === 'validated' || claimStatus === 'rejected') {
      setLocalClaimValidating(false);
    }
    
    if (isClaiming === false) {
      setLocalClaimValidating(false);
    }
  }, [claimStatus, isClaiming]);

  // Auto-reset claim status after validation (to allow claiming for next pattern)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (localClaimStatus === 'validated' || localClaimStatus === 'rejected') {
      console.log(`Setting up auto-reset for claim status: ${localClaimStatus}`);
      
      // Reset status after 5 seconds to allow claiming for next pattern
      timer = setTimeout(() => {
        console.log("Auto-resetting claim status");
        setLocalClaimStatus(null);
      }, 5000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [localClaimStatus]);

  // Listen for claim result broadcasts
  useEffect(() => {
    if (!currentSession?.id || !playerCode) return;
    
    console.log("Setting up claim result broadcast listener for player");
    
    const claimsChannel = supabase
      .channel('player-claims-listener')
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
      
    // Listen for general game updates
    const gameUpdatesChannel = supabase
      .channel('player-game-updates')
      .on(
        'broadcast',
        { event: 'claim-update' },
        (payload) => {
          console.log("Received claim update broadcast:", payload);
          // Update claim status when any claim is processed
          if (payload.payload && payload.payload.sessionId === currentSession.id && 
              payload.payload.result === 'valid') {
            setLocalClaimStatus('validated');
            setLocalClaimValidating(false);
          } else if (payload.payload && payload.payload.sessionId === currentSession.id && 
              payload.payload.result === 'false') {
            setLocalClaimStatus('rejected');
            setLocalClaimValidating(false);
          }
          
          // Reset claim status when pattern changes due to game progression
          if (payload.payload && 
              payload.payload.sessionId === currentSession.id && 
              payload.payload.patternChange === true) {
            console.log("Pattern changed, resetting claim status");
            setLocalClaimStatus(null);
            setLocalClaimValidating(false);
            
            // If a new pattern is provided, update lastWinPattern to force re-evaluation
            if (payload.payload.nextPattern && payload.payload.nextPattern !== lastWinPattern) {
              setLastWinPattern(null);
            }
          }
        }
      )
      .subscribe();
    
    // Listen for game progression updates
    const progressChannel = supabase
      .channel('game-progression-channel')
      .on(
        'broadcast',
        { event: 'game-progression' },
        (payload) => {
          console.log("Received game progression broadcast:", payload);
          
          if (payload.payload && payload.payload.sessionId === currentSession.id) {
            console.log("Game progressed, resetting claim status");
            // Reset claim status when game progresses to new pattern
            setLocalClaimStatus(null);
            setLocalClaimValidating(false);
            setLastWinPattern(null); // Reset to force update on next render
            
            // Show specific toast based on what changed
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
      supabase.removeChannel(claimsChannel);
      supabase.removeChannel(gameUpdatesChannel);
      supabase.removeChannel(progressChannel);
    };
  }, [currentSession?.id, playerCode, toast, lastWinPattern, currentWinPattern]);

  const handleClaimClick = async () => {
    if (localClaimValidating || isClaiming || localClaimStatus === 'validated') {
      console.log("Claim already in progress or validated, ignoring click");
      return;
    }
    
    try {
      console.log("Attempting to claim bingo");
      setLocalClaimValidating(true);
      const success = await onClaimBingo();
      
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
  
  const isClaimInProgress = localClaimValidating || isClaiming || claimStatus === 'pending';
  const isClaimValidated = localClaimStatus === 'validated' || claimStatus === 'validated';
  
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
                Current Win Pattern: <span className="font-bold text-white">{
                  getPatternDisplayName(currentWinPattern)
                }</span>
              </p>
              {winPrizes && winPrizes[currentWinPattern] && (
                <p className="text-sm text-gray-300 mt-1">
                  Prize: <span className="font-bold text-white">{winPrizes[currentWinPattern]}</span>
                </p>
              )}
            </div>
          )}
        </div>
        
        <div className="bg-black text-white p-4 border-t border-gray-700 sticky bottom-0" style={{ height: '30vw', maxHeight: '400px' }}>
          <CurrentNumberDisplay number={currentNumber} sizePx={Math.min(window.innerWidth * 0.25, 350)} gameType={gameType} />
          <div className="text-xs text-gray-400 mt-2 text-center">
            {calledNumbers.length} numbers called
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
