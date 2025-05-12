
import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Grid3X3, CreditCard, Wifi, WifiOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Button
                size="icon"
                variant="secondary"
                className="rounded-full shadow-lg"
                onClick={onToggleTicketView}
              >
                {isTicketView ? <Grid3X3 /> : <CreditCard />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isTicketView ? 'Grid View' : 'Card View'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      {onRefreshConnection && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Button
                size="icon"
                variant={isConnected ? "outline" : "destructive"}
                className="rounded-full shadow-lg"
                onClick={onRefreshConnection}
              >
                {isConnected ? <Wifi className="text-green-500" /> : <WifiOff />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isConnected ? 'Connected' : 'Reconnect'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      {onRefreshConnection && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Button
                size="icon"
                variant="outline"
                className="rounded-full shadow-lg"
                onClick={onRefreshConnection}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Refresh</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
