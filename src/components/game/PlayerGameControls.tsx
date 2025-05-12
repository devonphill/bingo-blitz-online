
import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Grid3X3, CreditCard, Wifi, WifiOff } from 'lucide-react';

interface PlayerGameControlsProps {
  isConnected?: boolean;
  onToggleTicketView?: () => void;
  onRefreshConnection?: () => void;
  isTicketView?: boolean;
  showTicketToggle?: boolean;
}

export default function PlayerGameControls({
  isConnected = true,
  onToggleTicketView,
  onRefreshConnection,
  isTicketView = true,
  showTicketToggle = true
}: PlayerGameControlsProps) {
  return (
    <div className="fixed bottom-20 right-4 flex flex-col gap-2 z-10">
      {showTicketToggle && onToggleTicketView && (
        <Button
          size="icon"
          variant="secondary"
          className="rounded-full shadow-lg"
          onClick={onToggleTicketView}
        >
          {isTicketView ? <Grid3X3 /> : <CreditCard />}
        </Button>
      )}
      
      {onRefreshConnection && (
        <Button
          size="icon"
          variant={isConnected ? "outline" : "destructive"}
          className="rounded-full shadow-lg"
          onClick={onRefreshConnection}
        >
          {isConnected ? <Wifi className="text-green-500" /> : <WifiOff />}
        </Button>
      )}
      
      {onRefreshConnection && (
        <Button
          size="icon"
          variant="outline"
          className="rounded-full shadow-lg"
          onClick={onRefreshConnection}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
