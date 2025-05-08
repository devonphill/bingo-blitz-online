
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BingoClaimProps {
  onClaimBingo: () => Promise<boolean>;
  claimStatus: 'none' | 'pending' | 'valid' | 'invalid';
  isClaiming: boolean;
  resetClaimStatus?: () => void;
}

export default function BingoClaim({
  onClaimBingo,
  claimStatus,
  isClaiming,
  resetClaimStatus
}: BingoClaimProps) {
  // Reset claim ability based on status changes
  useEffect(() => {
    if (claimStatus === 'valid' || claimStatus === 'invalid') {
      // After a delay, allow claiming again
      const timer = setTimeout(() => {
        if (resetClaimStatus) {
          resetClaimStatus();
        }
      }, 5000); // 5 second timeout for showing claim result
      
      return () => clearTimeout(timer);
    }
  }, [claimStatus, resetClaimStatus]);
  
  const handleClick = async () => {
    try {
      console.log("BingoClaim: Submitting bingo claim");
      await onClaimBingo();
    } catch (error) {
      console.error("Error claiming bingo:", error);
    }
  };
  
  // Render different button states based on claim status
  const renderButton = () => {
    switch (claimStatus) {
      case 'pending':
        return (
          <Button
            disabled
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600"
          >
            <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent" />
            <span>Verifying...</span>
          </Button>
        );
        
      case 'valid':
        return (
          <Button 
            disabled
            className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Bingo Verified!</span>
          </Button>
        );
        
      case 'invalid':
        return (
          <Button 
            disabled
            className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
          >
            <XCircle className="h-4 w-4" />
            <span>Invalid Claim</span>
          </Button>
        );
        
      default:
        return (
          <Button
            onClick={handleClick}
            disabled={isClaiming}
            className={cn(
              "bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary flex items-center gap-2",
              isClaiming && "opacity-70 cursor-not-allowed"
            )}
          >
            {isClaiming ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent" />
                <span>Claiming...</span>
              </>
            ) : (
              <>
                <Trophy className="h-5 w-5" />
                <span>BINGO!</span>
              </>
            )}
          </Button>
        );
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-xs">
        {renderButton()}
      </div>
    </div>
  );
}
