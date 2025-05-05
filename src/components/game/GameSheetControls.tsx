
import React from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, RefreshCw, Loader } from 'lucide-react';

interface GameSheetControlsProps {
  onClaimBingo?: () => Promise<boolean>;
  onRefreshTickets?: () => void;
  claimStatus?: 'none' | 'pending' | 'valid' | 'invalid';
  isClaiming?: boolean;
  isRefreshing?: boolean;
}

export default function GameSheetControls({
  onClaimBingo,
  onRefreshTickets,
  claimStatus = 'none',
  isClaiming = false,
  isRefreshing = false
}: GameSheetControlsProps) {
  
  // Determine button appearance based on claim status
  const getClaimButton = () => {
    switch (claimStatus) {
      case 'pending':
        return (
          <Button
            disabled
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600"
          >
            <Loader className="h-4 w-4 animate-spin" />
            <span>Verifying...</span>
          </Button>
        );
        
      case 'valid':
        return (
          <Button 
            disabled
            className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
          >
            <span>Bingo Verified!</span>
          </Button>
        );
        
      case 'invalid':
        return (
          <Button 
            disabled
            className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
          >
            <span>Invalid Claim</span>
          </Button>
        );
        
      default:
        return (
          <Button
            onClick={onClaimBingo}
            disabled={isClaiming}
            className="flex items-center gap-2"
            size="lg"
          >
            {isClaiming ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
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
    <div className="sticky bottom-0 bg-white border-t p-4 shadow-lg">
      <div className="container mx-auto flex justify-between items-center">
        <div>
          {onRefreshTickets && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshTickets}
              disabled={isRefreshing}
              className="flex items-center gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
        
        <div>
          {onClaimBingo && getClaimButton()}
        </div>
      </div>
    </div>
  );
}
