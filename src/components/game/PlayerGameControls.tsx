
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, RefreshCw, Undo2, RefreshCcw, Wifi, WifiOff } from 'lucide-react';
import ConnectionStatus from './ConnectionStatus';

interface PlayerGameControlsProps {
  onClaimBingo?: () => Promise<boolean>;
  claimStatus?: 'none' | 'pending' | 'valid' | 'invalid';
  isClaiming?: boolean;
  onRefreshTickets?: () => void;
  onReconnect?: () => void;
  sessionId?: string | null;
  playerId?: string | null;
  // Add the missing props
  isConnected?: boolean;
  onToggleTicketView?: () => void;
  onRefreshConnection?: () => void;
  isTicketView?: boolean;
  showTicketToggle?: boolean;
}

export default function PlayerGameControls({
  onClaimBingo,
  claimStatus = 'none',
  isClaiming = false,
  onRefreshTickets,
  onReconnect,
  sessionId,
  playerId,
  // Add the missing props with defaults
  isConnected = true,
  onToggleTicketView,
  onRefreshConnection,
  isTicketView = true,
  showTicketToggle = false
}: PlayerGameControlsProps) {
  return (
    <div className="fixed bottom-4 left-4 flex flex-col gap-2">
      {/* Connection status indicator */}
      <ConnectionStatus 
        showFull={true} 
        className="bg-white p-2 rounded-md shadow-md" 
        onReconnect={onRefreshConnection || onReconnect} 
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
      
      {/* Toggle ticket view button */}
      {showTicketToggle && onToggleTicketView && (
        <Button
          variant="outline"
          size="sm"
          className="bg-white shadow-md flex items-center gap-2"
          onClick={onToggleTicketView}
        >
          <RefreshCcw className="h-4 w-4" />
          <span className="text-xs">
            {isTicketView ? 'Show List View' : 'Show Ticket View'}
          </span>
        </Button>
      )}
      
      {/* Connection status button */}
      {onRefreshConnection && (
        <Button
          variant="outline"
          size="sm"
          className={`shadow-md flex items-center gap-2 ${isConnected ? 'bg-green-50' : 'bg-red-50'}`}
          onClick={onRefreshConnection}
        >
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-600" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-600" />
          )}
          <span className="text-xs">
            {isConnected ? 'Connected' : 'Reconnect'}
          </span>
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
