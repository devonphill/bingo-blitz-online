import React, { useState, useEffect } from "react";
import CurrentNumberDisplay from "@/components/game/CurrentNumberDisplay";
import CalledNumbers from "@/components/game/CalledNumbers";
import PlayerTicketsPanel from "@/components/game/PlayerTicketsPanel";
import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  useEffect(() => {
    if (!currentSession?.id || !playerCode) return;
    
    const claimsChannel = supabase
      .channel('player-claims-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bingo_claims',
          filter: `player_id=eq.${playerCode}`
        },
        () => {
          setIsClaimValidating(true);
          toast({
            title: "Claim Submitted",
            description: "Your claim is being verified by the caller.",
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bingo_claims',
          filter: `player_id=eq.${playerCode}`
        },
        (payload: any) => {
          if (payload.new.status === 'validated') {
            setIsClaimValidating(false);
            toast({
              title: "Claim Verified!",
              description: "Your bingo claim has been verified.",
            });
          } else if (payload.new.status === 'rejected') {
            setIsClaimValidating(false);
            toast({
              title: "Claim Rejected",
              description: "Your claim was not valid. Please check your numbers.",
              variant: "destructive"
            });
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(claimsChannel);
    };
  }, [currentSession?.id, playerCode, toast]);

  const handleClaimClick = async () => {
    if (isClaimValidating) return;
    
    try {
      await onClaimBingo();
      setIsClaimValidating(true);
    } catch (error) {
      console.error("Error submitting claim:", error);
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
  
  return (
    <div className="min-h-screen w-full flex bg-gray-50">
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
        <div className="fixed bottom-0 left-0 w-[30%] max-w-[400px] min-w-[240px] flex items-center justify-center p-4 bg-gray-900">
          <CurrentNumberDisplay 
            number={currentNumber} 
            sizePx={Math.min(window.innerWidth * 0.3 * 0.8, 180)} 
          />
        </div>
      </div>
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
