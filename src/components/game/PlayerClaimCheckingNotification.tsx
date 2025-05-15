
import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { getWebSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';
import { logWithTimestamp } from '@/utils/logUtils';
import CallerTicketDisplay from './CallerTicketDisplay';
import { ClaimData } from '@/types/claim';

interface PlayerClaimCheckingNotificationProps {
  sessionId: string;
  playerCode?: string;
}

export default function PlayerClaimCheckingNotification({ 
  sessionId,
  playerCode 
}: PlayerClaimCheckingNotificationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [claimBeingChecked, setClaimBeingChecked] = useState<ClaimData | null>(null);
  const [isMyClaimBeingChecked, setIsMyClaimBeingChecked] = useState(false);

  // Listen for claim checking broadcasts
  useEffect(() => {
    if (!sessionId) return;

    const handleClaimValidatingEvent = (payload: any) => {
      try {
        logWithTimestamp('Received claim validating event:', 'info');
        console.log('Claim validating payload:', payload);

        // Check if this is for our session
        if (payload?.sessionId !== sessionId) {
          logWithTimestamp(`Ignoring claim validation for different session (${payload?.sessionId} != ${sessionId})`, 'info');
          return;
        }

        // Set the claim data
        setClaimBeingChecked({
          id: payload.claimId || 'unknown',
          playerId: payload.playerId || 'unknown',
          playerName: payload.playerName || 'Unknown Player',
          sessionId: payload.sessionId,
          ticket: payload.ticket,
          calledNumbers: payload.calledNumbers || [],
          winPattern: payload.winPattern || 'unknown',
          gameType: payload.gameType || 'mainstage',
          timestamp: payload.timestamp || new Date().toISOString(),
          status: 'pending'
        });

        // Check if this is my claim (based on playerCode, if available)
        const isMyClaimChecking = playerCode && (
          payload.playerCode === playerCode || payload.player_code === playerCode
        );
        
        setIsMyClaimBeingChecked(isMyClaimChecking);
        
        // Open the sheet
        setIsOpen(true);
        
        // Play sound for notification
        playNotificationSound();
        
        // Log the notification
        logWithTimestamp(`Claim check notification opened for ${payload.playerName}`, 'info');
      } catch (error) {
        console.error('Error processing claim validating event:', error);
      }
    };

    // Subscribe to claim validating events (CLAIM_VALIDATING_TKT)
    const webSocketService = getWebSocketService();
    
    // Create a channel and add listener
    const channel = webSocketService.createChannel(CHANNEL_NAMES.GAME_UPDATES);
    
    // Add listener for claim validating events
    const cleanupListener = webSocketService.addListener(
      CHANNEL_NAMES.GAME_UPDATES, 
      'broadcast', 
      EVENT_TYPES.CLAIM_VALIDATING_TKT, 
      (payloadWrapper) => {
        const payload = payloadWrapper?.payload;
        if (payload) {
          handleClaimValidatingEvent(payload);
        }
      }
    );
    
    // Also listen to custom browser events that might be dispatched by other components
    const handleCustomEvent = (event: CustomEvent) => {
      if (event.detail?.claim && event.detail?.type === 'checking') {
        handleClaimValidatingEvent(event.detail.claim);
      }
    };
    
    window.addEventListener('claimBroadcast', handleCustomEvent as EventListener);

    // Log that we've set up the listener
    logWithTimestamp(`Subscribed to claim validating events for session ${sessionId}`, 'info');
    
    // Clean up
    return () => {
      if (cleanupListener) {
        cleanupListener();
        logWithTimestamp(`Unsubscribed from claim validating events listener`, 'info');
      }
      window.removeEventListener('claimBroadcast', handleCustomEvent as EventListener);
    };
  }, [sessionId, playerCode]);

  // Function to play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/notification-sound.mp3');
      audio.volume = 0.5;
      audio.play().catch((err) => {
        // Ignore autoplay errors - browsers often block without user interaction
        console.log('Audio play was prevented:', err);
      });
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  };

  if (!claimBeingChecked) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="sm:max-w-lg" side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
            Claim Being Checked
          </SheetTitle>
          <SheetDescription>
            The caller is currently checking a claim.
            {isMyClaimBeingChecked && (
              <div className="mt-1 font-semibold text-blue-600">
                This is your claim!
              </div>
            )}
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-amber-800 mb-2">Claim Information</h3>
            <div className="grid gap-1 text-sm">
              <div>
                <span className="font-medium">Player: </span>
                {claimBeingChecked.playerName}
              </div>
              <div>
                <span className="font-medium">Pattern: </span>
                {claimBeingChecked.winPattern}
              </div>
              <div>
                <span className="font-medium">Claimed at: </span>
                {new Date(claimBeingChecked.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
          
          {/* Display the ticket being checked */}
          {claimBeingChecked.ticket && (
            <div className="mt-4 border-t pt-4">
              <h3 className="text-sm font-medium mb-2">Claimed Ticket:</h3>
              <CallerTicketDisplay
                ticket={{
                  numbers: claimBeingChecked.ticket?.numbers,
                  layoutMask: claimBeingChecked.ticket?.layoutMask || claimBeingChecked.ticket?.layout_mask,
                  serial: claimBeingChecked.ticket?.serial,
                  perm: claimBeingChecked.ticket?.perm,
                  position: claimBeingChecked.ticket?.position
                }}
                calledNumbers={claimBeingChecked.calledNumbers || []}
                lastCalledNumber={null}
                gameType={claimBeingChecked.gameType || 'mainstage'}
                winPattern={claimBeingChecked.winPattern || 'oneLine'}
              />
            </div>
          )}
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 mb-2">
              The caller is verifying this claim. This notification will close automatically when the verification is complete.
            </p>
            <Button 
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="w-full mt-2"
            >
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
