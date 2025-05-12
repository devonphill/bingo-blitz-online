import React, { useEffect, useState } from "react";
import { getGameRulesForType } from '@/game-rules/gameRulesRegistry';
import { checkMainstageWinPattern } from '@/utils/mainstageWinLogic';
import { useMainstageAutoMarking } from '@/hooks/useMainstageAutoMarking';
import { toast } from "@/hooks/use-toast";
import { logWithTimestamp } from "@/utils/logUtils";

interface BingoWinProgressProps {
  tickets?: any[];
  numbers?: number[];
  layoutMask?: number;
  calledNumbers?: number[];
  activeWinPatterns: string[];
  currentWinPattern?: string | null;
  gameType?: string;
  handleClaimBingo?: () => Promise<boolean>;
  isClaiming?: boolean;
  claimStatus?: 'pending' | 'validated' | 'rejected';
}

export default function BingoWinProgress({
  tickets,
  numbers,
  layoutMask,
  calledNumbers = [],
  activeWinPatterns,
  currentWinPattern,
  gameType = 'mainstage',
  handleClaimBingo,
  isClaiming,
  claimStatus
}: BingoWinProgressProps) {
  const [hasTriedClaim, setHasTriedClaim] = useState(false);
  // Get the game rules for this game type
  const gameRules = getGameRulesForType(gameType);
  
  // If we have tickets but don't have specific card data,
  // we'll use the first ticket's data or just show the claim button
  if ((!numbers || !layoutMask) && tickets && tickets.length > 0) {
    // Use first ticket for checking win pattern
    const firstTicket = tickets[0];
    
    if (firstTicket && firstTicket.numbers && (firstTicket.layoutMask || firstTicket.layout_mask)) {
      numbers = firstTicket.numbers;
      layoutMask = firstTicket.layoutMask || firstTicket.layout_mask;
    }
  }
  
  // Reset hasTriedClaim when claim status changes or component re-mounts
  useEffect(() => {
    if (claimStatus === null || claimStatus === undefined) {
      logWithTimestamp("BingoWinProgress: Resetting claim status", "info");
      setHasTriedClaim(false);
    }
  }, [claimStatus]);
  
  // If we still don't have ticket data, just show the claim button if provided
  if (!numbers || !layoutMask) {
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-white rounded-lg shadow-sm border border-gray-200">
        <span className="font-medium text-gray-700">
          Win Pattern: {currentWinPattern || (activeWinPatterns.length > 0 ? activeWinPatterns[0] : "None")}
        </span>
        
        {handleClaimBingo && (
          <button
            onClick={async () => {
              setHasTriedClaim(true);
              try {
                await handleClaimBingo();
              } catch (error) {
                console.error("Error claiming bingo:", error);
                // Reset the hasTriedClaim after a timeout if there was an error
                setTimeout(() => setHasTriedClaim(false), 3000);
                toast({
                  title: "Claim Error",
                  description: "There was a problem submitting your claim.",
                  variant: "destructive",
                  duration: 5000, // 5 seconds duration
                });
              }
            }}
            disabled={isClaiming || claimStatus === 'validated' || hasTriedClaim}
            className={`px-4 py-2 rounded-md font-medium ${
              claimStatus === 'validated' ? 'bg-green-500 text-white' : 
              claimStatus === 'rejected' ? 'bg-red-500 text-white' :
              isClaiming ? 'bg-yellow-500 text-white' : 
              'bg-bingo-primary text-white hover:bg-bingo-secondary'
            }`}
          >
            {claimStatus === 'validated' ? 'Win Verified!' : 
             claimStatus === 'rejected' ? 'Claim Rejected' :
             isClaiming ? 'Verifying...' : 'Claim Bingo!'}
          </button>
        )}
      </div>
    );
  }

  const { card } = useMainstageAutoMarking({
    numbers,
    layoutMask,
    calledNumbers,
    autoMarking: true
  });

  // We'll prioritize the current win pattern if provided, otherwise use activeWinPatterns
  let actualWinPattern = currentWinPattern || (activeWinPatterns.length > 0 ? activeWinPatterns[0] : "oneLine");
  
  // Ensure we're using the proper pattern format for maintstage
  if (gameType === 'mainstage' && !actualWinPattern.startsWith('MAINSTAGE_')) {
    actualWinPattern = `MAINSTAGE_${actualWinPattern}`;
  }
  
  // Use the properly formatted pattern for win checking
  const result = checkMainstageWinPattern(
    card,
    calledNumbers,
    actualWinPattern as 'oneLine' | 'twoLines' | 'fullHouse' | 'MAINSTAGE_oneLine' | 'MAINSTAGE_twoLines' | 'MAINSTAGE_fullHouse'
  );
  
  const canClaim = result.isWinner;
  const minTG = result.tg;
  
  // Check for missed claim
  let missedBy = 0;
  if (canClaim) {
    // Simulate removing numbers one by one from the end
    for (let i = calledNumbers.length - 1; i >= 0; i--) {
      const testNumbers = calledNumbers.slice(0, i);
      const testResult = checkMainstageWinPattern(
        card,
        testNumbers,
        actualWinPattern as any
      );
      
      if (!testResult.isWinner) {
        // We've found when this ticket became a winner
        missedBy = calledNumbers.length - i - 1;
        break;
      }
    }
  }
  
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="flex flex-col">
        <span className="text-sm text-gray-600">Current Pattern: <span className="font-semibold">{actualWinPattern.replace('MAINSTAGE_', '')}</span></span>
        {missedBy > 0 ? (
          <span className="font-medium text-orange-600">
            Missed claim by {missedBy} number{missedBy > 1 ? 's' : ''}!
          </span>
        ) : (
          <span className={minTG <= 3 ? "font-bold text-green-600" : "font-medium text-gray-700"}>
            {minTG === 0 
              ? "Bingo!" 
              : minTG === 1 
                ? "1TG" 
                : minTG === 2 
                  ? "2TG" 
                  : minTG === 3 
                    ? "3TG" 
                    : `${minTG} to go`}
          </span>
        )}
      </div>
      
      {handleClaimBingo && (
        <button
          onClick={async () => {
            setHasTriedClaim(true);
            try {
              await handleClaimBingo();
            } catch (error) {
              console.error("Error claiming bingo:", error);
              // Reset claim status after error
              setTimeout(() => setHasTriedClaim(false), 3000);
              toast({
                title: "Claim Error",
                description: "There was a problem submitting your claim.",
                variant: "destructive",
                duration: 5000, // 5 seconds duration
              });
            }
          }}
          disabled={isClaiming || claimStatus === 'validated' || hasTriedClaim || (!canClaim && !hasTriedClaim)}
          className={`px-4 py-2 rounded-md font-medium ${
            claimStatus === 'validated' ? 'bg-green-500 text-white' : 
            claimStatus === 'rejected' ? 'bg-red-500 text-white' :
            isClaiming ? 'bg-yellow-500 text-white' : 
            canClaim ? 'bg-bingo-primary text-white hover:bg-bingo-secondary' :
            'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {claimStatus === 'validated' ? 'Win Verified!' : 
           claimStatus === 'rejected' ? 'Claim Rejected' :
           isClaiming ? 'Verifying...' : 
           missedBy > 0 ? 'Claim Late Win!' : 'Claim Bingo!'}
        </button>
      )}
    </div>
  );
}
