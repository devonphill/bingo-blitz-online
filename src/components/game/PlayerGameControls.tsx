
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, RefreshCw, Undo2 } from 'lucide-react';
import ConnectionStatus from './ConnectionStatus';

interface PlayerGameControlsProps {
  onClaimBingo?: () => Promise<boolean>;
  claimStatus?: 'none' | 'pending' | 'valid' | 'invalid';
  isClaiming?: boolean;
  onRefreshTickets?: () => void;
  onReconnect?: () => void;
  sessionId?: string | null;
  playerId?: string | null;
}

export default function PlayerGameControls({
  onClaimBingo,
  claimStatus = 'none',
  isClaiming = false,
  onRefreshTickets,
  onReconnect,
  sessionId,
  playerId
}: PlayerGameControlsProps) {
  return (
    <div className="fixed bottom-4 left-4 flex flex-col gap-2">
      {/* Connection status indicator */}
      <ConnectionStatus 
        showFull={true} 
        className="bg-white p-2 rounded-md shadow-md" 
        onReconnect={onReconnect} 
      />
      
      {/* Refresh tickets button */}
      {onRefreshTickets && (
        <Button 
          variant="outline" 
          size="sm" 
          className="bg-white shadow-md flex items-center gap-2"
          onClick={onRefreshTickets}
        >
          <RefreshCw className="h-4 w-4" />
          <span className="text-xs">Refresh tickets</span>
        </Button>
      )}
      
      {/* Claim bingo button - shown in small controls */}
      {onClaimBingo && (
        <Button
          variant="default"
          size="sm"
          className="bg-red-600 hover:bg-red-700 shadow-md flex items-center gap-2"
          onClick={onClaimBingo}
          disabled={isClaiming || claimStatus === 'valid'}
        >
          <ArrowUpRight className="h-4 w-4" />
          <span className="text-xs">
            {claimStatus === 'valid' ? 'Bingo confirmed!' : 
             claimStatus === 'invalid' ? 'Claim rejected' :
             isClaiming ? 'Claiming...' : 'BINGO!'}
          </span>
        </Button>
      )}
    </div>
  );
}
