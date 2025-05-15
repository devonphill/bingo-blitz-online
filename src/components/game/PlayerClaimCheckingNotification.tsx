import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { logWithTimestamp } from '@/utils/logUtils';
import CallerTicketDisplay from './CallerTicketDisplay';
import { ClaimData } from '@/types/claim';
import { useWebSocket } from '@/hooks/useWebSocket';

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
  const [claimResult, setClaimResult] = useState<'valid' | 'rejected' | null>(null);
  const instanceId = React.useRef(`claimNotify-${Math.random().toString(36).substring(2, 7)}`).current;
  
  // Use the WebSocket hook
  const { listenForEvent, EVENTS } = useWebSocket(sessionId);

  // Listen for claim checking broadcasts
  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp(`[${instanceId}] Cannot setup claim notification listener: No session ID`, 'warn');
      return;
    }

    logWithTimestamp(`[${instanceId}] Setting up claim validation listener for session ${sessionId}`, 'info');

    // Function to handle claim validating event
    const handleClaimValidatingEvent = (payload: any) => {
      try {
        logWithTimestamp(`[${instanceId}] Received claim validating event:`, 'info');
        console.log('Claim validating payload:', payload);

        // Check if this is for our session
        if (payload?.sessionId !== sessionId) {
          logWithTimestamp(`[${instanceId}] Ignoring claim validation for different session (${payload?.sessionId} != ${sessionId})`, 'info');
          return;
        }

        // Set the claim data
        setClaimBeingChecked({
          id: payload.claimId || payload.id || 'unknown',
          playerId: payload.playerId || 'unknown',
          playerName: payload.playerName || payload.player_name || 'Unknown Player',
          sessionId: payload.sessionId || payload.session_id,
          ticket: payload.ticket || payload.ticket_details,
          calledNumbers: payload.calledNumbers || payload.called_numbers_snapshot || [],
          winPattern: payload.winPattern || payload.pattern_claimed || 'unknown',
          gameType: payload.gameType || 'mainstage',
          timestamp: payload.timestamp || payload.claimed_at || new Date().toISOString(),
          status: 'pending'
        });

        // Reset any previous claim result
        setClaimResult(null);

        // Check if this is my claim (based on playerCode, if available)
        const isMyClaimChecking = playerCode && (
          payload.playerCode === playerCode || 
          payload.player_code === playerCode
        );
        
        setIsMyClaimBeingChecked(isMyClaimChecking);
        
        // Open the sheet
        setIsOpen(true);
        
        // Play sound for notification
        playNotificationSound();
        
        // Log the notification
        logWithTimestamp(`[${instanceId}] Claim check notification opened for ${payload.playerName || payload.player_name}`, 'info');
      } catch (error) {
        console.error(`[${instanceId}] Error processing claim validating event:`, error);
      }
    };

    // Function to handle claim result event
    const handleClaimResultEvent = (payload: any) => {
      try {
        logWithTimestamp(`[${instanceId}] Received claim result event:`, 'info');
        console.log('Claim result payload:', payload);

        // Check if this claim result is for the current player
        if (playerCode && payload.playerId !== playerCode && !payload.isGlobalBroadcast) {
          logWithTimestamp(`[${instanceId}] Ignoring claim result for different player (${payload.playerId} != ${playerCode})`, 'info');
          return;
        }

        // If we don't have a claim being checked, but this is for our player code, open the sheet
        if (!claimBeingChecked && playerCode && payload.playerId === playerCode) {
          // Set minimal claim data from the result
          setClaimBeingChecked({
            id: payload.claimId || 'unknown',
            playerId: payload.playerId || 'unknown',
            playerName: payload.playerName || 'Unknown Player',
            sessionId: sessionId,
            ticket: payload.ticket || {},
            calledNumbers: [],
            winPattern: payload.patternClaimed || 'unknown',
            gameType: 'mainstage',
            timestamp: payload.timestamp || new Date().toISOString(),
            status: payload.result || 'pending'
          });
          
          setIsMyClaimBeingChecked(true);
          setIsOpen(true);
        }

        // Set the claim result
        setClaimResult(payload.result === 'valid' ? 'valid' : 'rejected');
        
        // Play notification sound for result
        playNotificationSound();

        // Log the result
        logWithTimestamp(`[${instanceId}] Claim result received: ${payload.result}`, 'info');
        
        // If the sheet is open, keep it open for 3 seconds and then close it
        if (isOpen || (playerCode && payload.playerId === playerCode)) {
          setTimeout(() => {
            setIsOpen(false);
            setClaimBeingChecked(null);
            setClaimResult(null);
          }, 3000);
        }
      } catch (error) {
        console.error(`[${instanceId}] Error processing claim result event:`, error);
      }
    };

    // Use listenForEvent from the WebSocket hook to listen for claim validating events
    const cleanupValidating = listenForEvent(
      EVENTS.CLAIM_VALIDATING_TKT,
      handleClaimValidatingEvent
    );
    
    // Listen for claim result events
    const cleanupResult = listenForEvent(
      'claim-result',
      handleClaimResultEvent
    );
    
    // Also listen to custom browser events that might be dispatched by other components
    const handleCustomEvent = (event: CustomEvent) => {
      logWithTimestamp(`[${instanceId}] Received custom claimBroadcast event`, 'info');
      console.log('Custom event details:', event.detail);
      
      if (event.detail?.claim && event.detail?.type === 'checking') {
        handleClaimValidatingEvent(event.detail.claim);
      } else if (event.detail?.claim && event.detail?.type === 'result') {
        handleClaimResultEvent(event.detail.claim);
      }
    };
    
    window.addEventListener('claimBroadcast', handleCustomEvent as EventListener);
    
    // Listen for forceOpenClaimDrawer events
    const handleForceOpenEvent = (event: CustomEvent) => {
      logWithTimestamp(`[${instanceId}] Received forceOpenClaimDrawer event`, 'info');
      console.log('Force open event details:', event.detail);
      
      if (event.detail?.data) {
        handleClaimValidatingEvent(event.detail.data);
      }
    };
    
    window.addEventListener('forceOpenClaimDrawer', handleForceOpenEvent as EventListener);

    // Log that we've set up the listener
    logWithTimestamp(`[${instanceId}] Subscribed to claim validating events for session ${sessionId}`, 'info');
    
    // Clean up
    return () => {
      cleanupValidating();
      cleanupResult();
      window.removeEventListener('claimBroadcast', handleCustomEvent as EventListener);
      window.removeEventListener('forceOpenClaimDrawer', handleForceOpenEvent as EventListener);
      logWithTimestamp(`[${instanceId}] Cleaned up claim validating events listener`, 'info');
    };
  }, [sessionId, playerCode, instanceId, listenForEvent, EVENTS, isOpen, claimBeingChecked]);

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
            {claimResult ? (
              claimResult === 'valid' ? 'Claim Validated!' : 'Claim Rejected'
            ) : (
              'Claim Being Checked'
            )}
          </SheetTitle>
          <SheetDescription>
            {claimResult ? (
              claimResult === 'valid' ? 
                'Your claim has been validated by the caller!' : 
                'The caller has rejected this claim.'
            ) : (
              'The caller is currently checking a claim.'
            )}
            {isMyClaimBeingChecked && !claimResult && (
              <div className="mt-1 font-semibold text-blue-600">
                This is your claim!
              </div>
            )}
          </SheetDescription>
        </SheetHeader>
        
        {/* Show claim result overlay if available */}
        {claimResult && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
            <div className="bg-white rounded-full p-8 shadow-lg">
              {claimResult === 'valid' ? (
                <CheckCircle className="h-20 w-20 text-green-500" />
              ) : (
                <XCircle className="h-20 w-20 text-red-500" />
              )}
            </div>
          </div>
        )}
        
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
              {claimResult ? 
                'This notification will close automatically.' : 
                'The caller is verifying this claim. This notification will close automatically when the verification is complete.'}
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
