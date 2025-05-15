
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
    if (!sessionId) {
      logWithTimestamp('PlayerClaimCheckingNotification: Cannot setup listener - No session ID', 'warn');
      return;
    }

    logWithTimestamp(`PlayerClaimCheckingNotification: Setting up listener for session ${sessionId}`, 'info');

    const handleClaimValidatingEvent = (payload: any) => {
      try {
        // Detailed logging as requested
        console.log('[PlayerClaimCheckingNotification] <<<< RAW EVENT RECEIVED FOR CLAIM_VALIDATING_TKT >>>> PayloadWrapper:', 
          JSON.stringify(payload, null, 2));
        
        if (!payload) {
          console.error('[PlayerClaimCheckingNotification] Received event but payload is missing or undefined.');
          return;
        }

        // Log specific fields critical for display
        console.log(`[PlayerClaimCheckingNotification] Details: Claim ID: ${payload.claimId || payload.id}, ` +
          `Player: ${payload.playerName || payload.player_name}, ` + 
          `Session IDs - Event: ${payload.sessionId}, Component: ${sessionId}`);

        // Check if this is for our session
        if (payload?.sessionId && payload.sessionId !== sessionId) {
          logWithTimestamp(`PlayerClaimCheckingNotification: Ignoring claim validation for different session (${payload.sessionId} != ${sessionId})`, 'info');
          console.log(`[PlayerClaimCheckingNotification] Session ID mismatch: payload ${payload.sessionId} vs component ${sessionId}`);
          // For now, we'll still process it even if session IDs don't match (matches hook behavior)
        }

        // Log ticket details if present
        if (payload.ticket || payload.ticket_details) {
          console.log('[PlayerClaimCheckingNotification] Ticket details:', 
            JSON.stringify(payload.ticket || payload.ticket_details, null, 2));
        }

        // Set the claim data
        const claimData = {
          id: payload.claimId || payload.id || 'unknown',
          playerId: payload.playerId || payload.player_id || 'unknown',
          playerName: payload.playerName || payload.player_name || 'Unknown Player',
          sessionId: payload.sessionId || payload.session_id || sessionId,
          ticket: payload.ticket || payload.ticket_details,
          calledNumbers: payload.calledNumbers || payload.called_numbers_snapshot || [],
          winPattern: payload.winPattern || payload.pattern_claimed || 'unknown',
          gameType: payload.gameType || payload.game_type || 'mainstage',
          timestamp: payload.timestamp || payload.claimed_at || new Date().toISOString(),
          status: payload.status || 'pending'
        };

        // Log transformed claim data
        console.log('[PlayerClaimCheckingNotification] Transformed claim data:', JSON.stringify(claimData, null, 2));

        setClaimBeingChecked(claimData);

        // Check if this is my claim (based on playerCode, if available)
        const isMyClaimChecking = playerCode && (
          payload.playerCode === playerCode || 
          payload.player_code === playerCode
        );
        
        setIsMyClaimBeingChecked(isMyClaimChecking);
        console.log(`[PlayerClaimCheckingNotification] Is my claim being checked: ${isMyClaimChecking}`);
        
        // Open the sheet
        setIsOpen(true);
        console.log('[PlayerClaimCheckingNotification] Sheet set to open');
        
        // Play sound for notification
        playNotificationSound();
        
        // Log the notification
        logWithTimestamp(`Claim check notification opened for ${payload.playerName || payload.player_name}`, 'info');
      } catch (error) {
        console.error('[PlayerClaimCheckingNotification] Error processing claim validating event:', error);
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
        logWithTimestamp('PlayerClaimCheckingNotification: Received claim validating broadcast event', 'info');
        console.log('[PlayerClaimCheckingNotification] Full payload wrapper:', payloadWrapper);
        
        const payload = payloadWrapper?.payload;
        if (payload) {
          handleClaimValidatingEvent(payload);
        } else {
          logWithTimestamp('PlayerClaimCheckingNotification: Invalid payload in claim validating event', 'warn');
        }
      }
    );
    
    // Also listen to custom browser events that might be dispatched by other components
    const handleCustomEvent = (event: CustomEvent) => {
      logWithTimestamp('PlayerClaimCheckingNotification: Received custom claimBroadcast event', 'info');
      console.log('[PlayerClaimCheckingNotification] Custom event details:', event.detail);
      
      if (event.detail?.claim && event.detail?.type === 'checking') {
        handleClaimValidatingEvent(event.detail.claim);
      }
    };
    
    window.addEventListener('claimBroadcast', handleCustomEvent as EventListener);
    
    // Listen for forceOpenClaimDrawer events
    const handleForceOpenEvent = (event: CustomEvent) => {
      logWithTimestamp('PlayerClaimCheckingNotification: Received forceOpenClaimDrawer event', 'info');
      console.log('[PlayerClaimCheckingNotification] Force open event details:', event.detail);
      
      if (event.detail?.data) {
        handleClaimValidatingEvent(event.detail.data);
      }
    };
    
    window.addEventListener('forceOpenClaimDrawer', handleForceOpenEvent as EventListener);

    // Manual trigger for testing - dispatch a synthetic event after a delay
    setTimeout(() => {
      try {
        // Only in dev environment to help with testing
        if (import.meta.env.DEV) {
          logWithTimestamp('PlayerClaimCheckingNotification: Dispatching synthetic test event for debugging', 'info');
          const testEvent = new CustomEvent('forceOpenClaimDrawer', {
            detail: {
              data: {
                id: 'test-claim-id',
                player_name: 'Test Player',
                sessionId: sessionId,
                pattern_claimed: 'One Line',
                claimed_at: new Date().toISOString(),
                ticket_details: {
                  numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9],
                  layoutMask: 511, // Binary 111111111
                  serial: 'TEST-123',
                  perm: 1234,
                  position: 1
                },
                called_numbers_snapshot: [1, 2, 3, 7, 9]
              }
            }
          });
          window.dispatchEvent(testEvent);
        }
      } catch (e) {
        console.error('Error dispatching test event:', e);
      }
    }, 5000);

    // Log that we've set up the listener
    logWithTimestamp(`PlayerClaimCheckingNotification: Subscribed to claim validating events for session ${sessionId}`, 'info');
    
    // Clean up
    return () => {
      if (cleanupListener) {
        cleanupListener();
        logWithTimestamp(`PlayerClaimCheckingNotification: Unsubscribed from claim validating events listener`, 'info');
      }
      window.removeEventListener('claimBroadcast', handleCustomEvent as EventListener);
      window.removeEventListener('forceOpenClaimDrawer', handleForceOpenEvent as EventListener);
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
