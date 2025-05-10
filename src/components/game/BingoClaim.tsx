
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import FixedClaimOverlay from './FixedClaimOverlay';
import ClaimResultDialog from './ClaimResultDialog';
import { toast } from 'sonner';

interface BingoClaimProps {
  onClaimBingo?: () => Promise<boolean>;
  claimStatus?: 'none' | 'pending' | 'valid' | 'invalid';
  isClaiming?: boolean;
  resetClaimStatus?: () => void;
  playerName?: string;
  currentTicket?: any;
  calledNumbers?: number[];
  sessionId?: string | null;
  playerId?: string | null;
}

// Create a global event system for claim events
const claimEvents = {
  listeners: new Set<(data: any) => void>(),
  addListener: (listener: (data: any) => void) => {
    claimEvents.listeners.add(listener);
    return () => claimEvents.listeners.delete(listener);
  },
  dispatch: (data: any) => {
    claimEvents.listeners.forEach(listener => listener(data));
  }
};

// Export the event system so it can be used from anywhere
export { claimEvents };

export default function BingoClaim({
  onClaimBingo,
  claimStatus = 'none',
  isClaiming = false,
  resetClaimStatus,
  playerName = 'Player',
  currentTicket,
  calledNumbers = [],
  sessionId,
  playerId
}: BingoClaimProps) {
  // State for claim checking overlay
  const [isClaimOverlayVisible, setIsClaimOverlayVisible] = useState(false);
  const [claimCheckData, setClaimCheckData] = useState<any>(null);
  
  // State for claim result dialog
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [claimResult, setClaimResult] = useState<'valid' | 'invalid' | null>(null);
  
  // Channels for real-time communication
  const [claimCheckingChannel, setClaimCheckingChannel] = useState<any>(null);
  const [claimResultChannel, setClaimResultChannel] = useState<any>(null);
  
  // Debug flag to check visibility issues
  const [debugVisibility, setDebugVisibility] = useState(false);
  
  // Set up channels for claim checking and results
  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp(`BingoClaim: No session ID provided, not setting up channels`, 'warn');
      return;
    }
    
    logWithTimestamp(`BingoClaim: Setting up channels for session ${sessionId}`, 'info');
    
    // Set up claim checking channel
    const checkingChannel = supabase
      .channel('claim_checking_broadcaster')
      .on('broadcast', { event: 'claim-checking' }, payload => {
        logWithTimestamp(`BingoClaim: Received claim checking broadcast: ${JSON.stringify(payload.payload)}`, 'info');
        
        // Check if this broadcast is for our session
        if (payload.payload?.sessionId === sessionId) {
          logWithTimestamp(`BingoClaim: Claim checking broadcast matches current session`, 'info');
          
          // Store the payload globally for debugging
          (window as any).lastClaimPayload = payload.payload;
          
          // Set claim data and force visibility to true
          setClaimCheckData(payload.payload);
          setIsClaimOverlayVisible(true);
          
          // Dispatch to global event system
          claimEvents.dispatch({
            type: 'claim-checking',
            data: payload.payload
          });
          
          // Show toast as a fallback notification
          toast.info(`${payload.payload.playerName || 'A player'} has claimed Bingo! Caller is checking...`, {
            duration: 10000,
            position: 'top-center',
          });
          
          // Add a timeout to verify state update and make a second attempt if needed
          setTimeout(() => {
            logWithTimestamp(`BingoClaim: Overlay visibility check: ${isClaimOverlayVisible}`, 'info');
            
            // If overlay isn't showing, try to force visibility again
            if (!document.querySelector('.fixed-claim-overlay')) {
              logWithTimestamp(`BingoClaim: Overlay not found in DOM, forcing visibility again`, 'warn');
              setDebugVisibility(true);
              setIsClaimOverlayVisible(true);
              
              // Try direct DOM manipulation as a last resort
              setTimeout(() => {
                const container = document.getElementById('fixed-overlay-container');
                if (!container || !container.children.length) {
                  logWithTimestamp(`BingoClaim: Creating overlay through direct DOM manipulation`, 'warn');
                  
                  // Create a temporary div for the notification
                  const tempNotification = document.createElement('div');
                  tempNotification.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded shadow-lg z-[10000]';
                  tempNotification.innerHTML = `
                    <div class="flex flex-col items-center">
                      <h3 class="text-lg font-bold">Claim Check</h3>
                      <p>${payload.payload.playerName || 'A player'} has claimed Bingo!</p>
                    </div>
                  `;
                  document.body.appendChild(tempNotification);
                  
                  // Remove after 5 seconds
                  setTimeout(() => {
                    document.body.removeChild(tempNotification);
                  }, 5000);
                }
              }, 500);
            }
          }, 100);
        }
      })
      .subscribe((status) => {
        logWithTimestamp(`BingoClaim: Claim checking channel status: ${status}`, 'info');
      });
    
    // Set up claim result channel
    const resultChannel = supabase
      .channel('game-updates')
      .on('broadcast', { event: 'claim-result' }, payload => {
        logWithTimestamp(`BingoClaim: Received claim result: ${JSON.stringify(payload.payload)}`, 'info');
        
        const result = payload.payload;
        
        // Store result globally for debugging
        (window as any).lastClaimResult = result;
        
        // Check if this result is for our session
        if (result.sessionId === sessionId) {
          logWithTimestamp(`BingoClaim: Claim result broadcast matches current session`, 'info');
          
          // If global broadcast or specific to this player
          if (result.isGlobalBroadcast || result.playerId === playerId) {
            const isValidClaim = result.result === 'valid';
            
            // Show appropriate toast notification
            toast(isValidClaim ? 'Bingo Winner!' : 'Claim Rejected', {
              description: isValidClaim 
                ? `${result.playerName || 'A player'} has won!` 
                : `The claim by ${result.playerName || 'a player'} was rejected`,
              position: 'top-center',
              duration: 5000
            });
            
            // Dispatch to global event system
            claimEvents.dispatch({
              type: 'claim-result',
              data: result
            });
            
            // Show result dialog
            logWithTimestamp(`BingoClaim: Opening claim result dialog with status: ${result.result}`, 'info');
            setClaimResult(result.result);
            setClaimCheckData({
              playerName: result.playerName,
              ticket: result.ticket
            });
            
            // Close checking overlay and open result dialog
            setIsClaimOverlayVisible(false);
            setIsResultOpen(true);
            setDebugVisibility(true);
            
            // Reset claim status if this was our claim and we have the function
            if (result.playerId === playerId && resetClaimStatus) {
              setTimeout(() => {
                resetClaimStatus();
              }, 2000);
            }
          }
        }
      })
      .subscribe((status) => {
        logWithTimestamp(`BingoClaim: Claim result channel status: ${status}`, 'info');
      });
    
    // Store channels for cleanup
    setClaimCheckingChannel(checkingChannel);
    setClaimResultChannel(resultChannel);
    
    // Clean up channels on unmount
    return () => {
      if (checkingChannel) supabase.removeChannel(checkingChannel);
      if (resultChannel) supabase.removeChannel(resultChannel);
      
      logWithTimestamp(`BingoClaim: Channels removed during cleanup`, 'info');
    };
  }, [sessionId, playerId, resetClaimStatus]);
  
  // Log visibility state changes for debugging
  useEffect(() => {
    logWithTimestamp(`BingoClaim: Visibility states - overlay: ${isClaimOverlayVisible}, result dialog: ${isResultOpen}`, 'info');
  }, [isClaimOverlayVisible, isResultOpen]);
  
  // Handle closing the overlay
  const handleOverlayClose = () => {
    logWithTimestamp(`BingoClaim: Closing claim overlay`, 'info');
    setIsClaimOverlayVisible(false);
  };
  
  // Handle dialog close events
  const handleResultClose = () => {
    logWithTimestamp(`BingoClaim: Closing claim result dialog`, 'info');
    setIsResultOpen(false);
    setDebugVisibility(false);
    
    // If we have a reset function, call it
    if (resetClaimStatus) {
      resetClaimStatus();
    }
  };
  
  return (
    <>
      {/* Fixed Position Claim Overlay - always included in DOM */}
      <FixedClaimOverlay
        isVisible={isClaimOverlayVisible}
        onClose={handleOverlayClose}
        claimData={claimCheckData}
      />
      
      <ClaimResultDialog
        isOpen={isResultOpen}
        onClose={handleResultClose}
        result={claimResult || 'invalid'}
        playerName={claimCheckData?.playerName || playerName || 'Player'}
        isGlobalBroadcast={true}
        ticket={claimCheckData?.ticket}
      />
      
      {/* Debug element to show visibility state */}
      {debugVisibility && (
        <div className="fixed bottom-2 left-2 bg-black/80 text-white p-2 text-xs z-[2000] rounded">
          Overlay Visible: {isClaimOverlayVisible.toString()}, Result Dialog: {isResultOpen.toString()}
        </div>
      )}
    </>
  );
}
