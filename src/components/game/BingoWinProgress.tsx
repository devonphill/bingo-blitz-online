
import React from "react";
import { getGameRulesForType } from '@/game-rules/gameRulesRegistry';

interface BingoWinProgressProps {
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
  numbers,
  layoutMask,
  calledNumbers = [],
  activeWinPatterns,
  currentWinPattern,
  gameType = '90-ball',
  handleClaimBingo,
  isClaiming,
  claimStatus
}: BingoWinProgressProps) {
  // Get the game rules for this game type
  const gameRules = getGameRulesForType(gameType);
  
  // If we don't have ticket data, just show the claim button if provided
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
  
  // Create a ticket object to pass to the rules engine
  const ticket = {
    numbers,
    layoutMask
  };
  
  // We'll prioritize the current win pattern if provided
  const patternsToCheck = currentWinPattern 
    ? [currentWinPattern] 
    : activeWinPatterns;
  
  const result: { [pattern: string]: number } = {};
  
  // Calculate distance to win for each pattern
  patternsToCheck.forEach(pattern => {
    const ticketStatus = gameRules.getTicketStatus(ticket, calledNumbers, pattern);
    result[pattern] = ticketStatus.distance;
  });
  
  // Get the distance for the current win pattern, or the minimum of all active patterns
  let minToGo = 15; // Default high value
  
  if (currentWinPattern && result[currentWinPattern] !== undefined) {
    minToGo = result[currentWinPattern];
  } else if (patternsToCheck.length > 0) {
    const distances = patternsToCheck.map(p => result[p] ?? 15);
    minToGo = Math.min(...distances);
  }
  
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white rounded-lg shadow-sm border border-gray-200">
      <span className={minToGo <= 3 ? "font-bold text-green-600" : "font-medium text-gray-700"}>
        {minToGo === 0 
          ? "Bingo!" 
          : minToGo === 1 
            ? "1TG" 
            : minToGo === 2 
              ? "2TG" 
              : minToGo === 3 
                ? "3TG" 
                : `${minToGo} to go`}
      </span>
      
      {handleClaimBingo && (
        <button
          onClick={handleClaimBingo}
          disabled={isClaiming || claimStatus === 'validated' || minToGo > 0}
          className={`px-4 py-2 rounded-md font-medium ${
            claimStatus === 'validated' ? 'bg-green-500 text-white' : 
            claimStatus === 'rejected' ? 'bg-red-500 text-white' :
            isClaiming ? 'bg-yellow-500 text-white' : 
            minToGo === 0 ? 'bg-bingo-primary text-white hover:bg-bingo-secondary' :
            'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {claimStatus === 'validated' ? 'Win Verified!' : 
           claimStatus === 'rejected' ? 'Claim Rejected' :
           isClaiming ? 'Verifying...' : 
           minToGo === 0 ? 'Claim Bingo!' : 'Not Bingo Yet'}
        </button>
      )}
    </div>
  );
}
