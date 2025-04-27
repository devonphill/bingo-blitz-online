
import React from "react";
import { getGameRulesForType } from '@/game-rules/gameRulesRegistry';
import { checkMainstageWinPattern } from '@/utils/mainstageWinLogic';
import { useMainstageAutoMarking } from '@/hooks/useMainstageAutoMarking';

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
  // Get the game rules for this game type
  const gameRules = getGameRulesForType(gameType);
  
  // If we have tickets but don't have specific card data,
  // we'll use the first ticket's data or just show the claim button
  if ((!numbers || !layoutMask) && tickets && tickets.length > 0) {
    // Use first ticket for checking win pattern
    const firstTicket = tickets[0];
    
    if (firstTicket && firstTicket.numbers && firstTicket.layoutMask) {
      numbers = firstTicket.numbers;
      layoutMask = firstTicket.layoutMask;
    }
  }
  
  // If we still don't have ticket data, just show the claim button if provided
  if (!numbers || !layoutMask) {
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-white rounded-lg shadow-sm border border-gray-200">
        <span className="font-medium text-gray-700">
          Win Patterns: {activeWinPatterns.join(', ')}
        </span>
        
        {handleClaimBingo && (
          <button
            onClick={handleClaimBingo}
            disabled={isClaiming || claimStatus === 'validated'}
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

  // We'll prioritize the current win pattern if provided
  const patternsToCheck = currentWinPattern 
    ? [currentWinPattern] 
    : activeWinPatterns;
  
  let minTG = 15; // Default high value
  let canClaim = false;
  
  // Check each pattern
  patternsToCheck.forEach(pattern => {
    const result = checkMainstageWinPattern(
      card,
      calledNumbers,
      pattern as 'oneLine' | 'twoLines' | 'fullHouse'
    );
    
    if (result.isWinner) {
      minTG = 0;
      canClaim = true;
    } else if (result.tg < minTG) {
      minTG = result.tg;
    }
  });
  
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white rounded-lg shadow-sm border border-gray-200">
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
      
      {handleClaimBingo && (
        <button
          onClick={handleClaimBingo}
          disabled={isClaiming || claimStatus === 'validated' || !canClaim}
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
           canClaim ? 'Claim Bingo!' : 'Not Bingo Yet'}
        </button>
      )}
    </div>
  );
}
