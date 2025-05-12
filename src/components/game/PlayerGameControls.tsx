
import React from 'react';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, TicketIcon, GridIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlayerGameControlsProps {
  isConnected: boolean;
  onToggleTicketView?: () => void;
  onRefreshConnection?: () => void;
  isTicketView?: boolean;
  showTicketToggle?: boolean;
}

export default function PlayerGameControls({
  isConnected,
  onToggleTicketView,
  onRefreshConnection,
  isTicketView = true,
  showTicketToggle = true,
}: PlayerGameControlsProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-between items-center z-20">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefreshConnection}
          className={cn(
            'text-xs flex items-center gap-1 px-2',
            isConnected ? 'text-green-600' : 'text-red-600 animate-pulse'
          )}
        >
          {isConnected ? (
            <Wifi className="h-3 w-3 text-green-600" />
          ) : (
            <WifiOff className="h-3 w-3 text-red-600" />
          )}
          {isConnected ? 'Connected' : 'Reconnecting...'}
        </Button>
      </div>

      {showTicketToggle && onToggleTicketView && (
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleTicketView}
          className="text-xs flex items-center gap-1"
        >
          {isTicketView ? (
            <>
              <GridIcon className="h-3 w-3" /> View Grid
            </>
          ) : (
            <>
              <TicketIcon className="h-3 w-3" /> View Tickets
            </>
          )}
        </Button>
      )}
    </div>
  );
}
