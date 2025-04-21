
import React, { useState, useEffect } from "react";
import CurrentNumberDisplay from "@/components/game/CurrentNumberDisplay";
import CalledNumbers from "@/components/game/CalledNumbers";
import PlayerTicketsPanel from "@/components/game/PlayerTicketsPanel";
import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Props for layout, kept minimal for panel orchestration
export default function PlayerGameLayout({
  tickets,
  calledNumbers,
  currentNumber,
  currentSession,
  autoMarking,
  setAutoMarking,
  playerCode,
  winPrizes,
  activeWinPatterns,
  currentWinPattern,
  onClaimBingo,
  errorMessage,
  isLoading,
}: any) {
  const [isClaimValidating, setIsClaimValidating] = useState(false);
  const [hasPendingClaim, setHasPendingClaim] = useState(false);
  const { toast } = useToast();

  // Check if player has a pending claim
  useEffect(() => {
    if (!currentSession?.id || !playerCode) return;
    
    const checkPendingClaims = async () => {
      try {
        const { data, error } = await supabase
          .from('bingo_claims')
          .select('id, status')
          .eq('session_id', currentSession.id)
          .eq('player_id', playerCode)
          .order('claimed_at', { ascending: false })
          .limit(1);
        
        if (!error && data && data.length > 0) {
          const latestClaim = data[0];
          // Set claim status based on the most recent claim
          if (latestClaim.status === 'pending') {
            setHasPendingClaim(true);
            setIsClaimValidating(true);
          } else if (latestClaim.status === 'validated') {
            // Clear validating state when claim is validated
            setIsClaimValidating(false);
            setHasPendingClaim(false);
            toast({
              title: "Bingo Validated!",
              description: "Your claim has been verified.",
              variant: "success"
            });
          } else if (latestClaim.status === 'rejected') {
            // Clear validating state when claim is rejected
            setIsClaimValidating(false);
            setHasPendingClaim(false);
            toast({
              title: "Claim Rejected",
              description: "Your claim was not valid. Please check your numbers.",
              variant: "destructive"
            });
          } else {
            setHasPendingClaim(false);
          }
        } else {
          setHasPendingClaim(false);
          setIsClaimValidating(false);
        }
      } catch (err) {
        console.error("Error checking pending claims:", err);
      }
    };
    
    // Check initially and set up interval
    checkPendingClaims();
    const interval = setInterval(checkPendingClaims, 5000); // Check every 5 seconds
    
    // Set up real-time listener for claim status changes
    const claimsChannel = supabase
      .channel('player-claims-listener')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bingo_claims',
          filter: `player_id=eq.${playerCode}`
        },
        (payload) => {
          console.log("Claim status changed:", payload);
          checkPendingClaims();
        }
      )
      .subscribe();
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(claimsChannel);
    };
  }, [currentSession?.id, playerCode, toast]);

  // Loading and error states
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading game...</h2>
        </div>
      </div>
    );
  }
  
  // Error display
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
  
  // Session not started yet
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
  
  const handleClaimClick = async () => {
    if (isClaimValidating || hasPendingClaim) return;
    
    setIsClaimValidating(true);
    setHasPendingClaim(true);
    
    try {
      await onClaimBingo();
      toast({
        title: "Claim Submitted",
        description: "Your Bingo claim has been submitted for verification.",
      });
    } catch (error) {
      console.error("Error submitting claim:", error);
      setIsClaimValidating(false);
      setHasPendingClaim(false);
      toast({
        title: "Claim Error",
        description: "There was a problem submitting your claim. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-gray-50">
      {/* Side Panels */}
      <div className="flex flex-col" style={{width:'30%', minWidth:240, maxWidth:400}}>
        <div className="flex-1 bg-black text-white p-4">
          <h1 className="text-xl font-bold mb-4">Bingo Game Info</h1>
          <Button
            className={`w-full ${isClaimValidating 
              ? 'bg-orange-500 hover:bg-orange-600' 
              : 'bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary'
            }`}
            onClick={handleClaimClick}
            disabled={isClaimValidating}
          >
            {isClaimValidating ? (
              <span className="flex items-center">
                <Loader className="animate-spin mr-2 h-4 w-4" />
                VALIDATING CLAIM...
              </span>
            ) : "CLAIM NOW!"}
          </Button>
          
          {isClaimValidating && (
            <p className="text-xs text-gray-300 mt-2 text-center">
              Your claim is being verified. Please wait...
            </p>
          )}
          
          {currentWinPattern && (
            <div className="mt-4 p-2 bg-gray-800 rounded">
              <p className="text-sm text-gray-300">
                Current Win Pattern: <span className="font-bold text-white">{currentWinPattern === 'oneLine' 
                  ? 'One Line' 
                  : currentWinPattern === 'twoLines'
                    ? 'Two Lines'
                    : 'Full House'}</span>
              </p>
              {winPrizes && winPrizes[currentWinPattern] && (
                <p className="text-sm text-gray-300 mt-1">
                  Prize: <span className="font-bold text-white">{winPrizes[currentWinPattern]}</span>
                </p>
              )}
            </div>
          )}
        </div>
        {/* Current Number Visual at bottom left corner positioned at the bottom of the viewport */}
        <div className="fixed bottom-0 left-0 w-[30%] max-w-[400px] min-w-[240px] flex items-center justify-center p-4 bg-gray-900">
          <CurrentNumberDisplay 
            number={currentNumber} 
            sizePx={Math.min(window.innerWidth * 0.3 * 0.8, 180)} 
          />
        </div>
      </div>
      {/* Main display area */}
      <div className="flex-1 bg-gray-50 h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PlayerTicketsPanel 
              tickets={tickets}
              calledNumbers={calledNumbers}
              autoMarking={autoMarking}
              activeWinPatterns={activeWinPatterns}
              currentWinPattern={currentWinPattern}
            />
            <div>
              <div className="bg-white shadow rounded-lg p-6">
                <CalledNumbers calledNumbers={calledNumbers} currentNumber={currentNumber} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
