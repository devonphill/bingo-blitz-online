
import React, { useState, useEffect, useRef } from 'react';
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
  disableEmergencyFallback?: boolean;
}

// Create a global event system for claim events
const claimEvents = {
  listeners: new Set<(data: any) => void>(),
  addListener: (listener: (data: any) => void) => {
    claimEvents.listeners.add(listener);
    return () => claimEvents.listeners.delete(listener);
  },
  dispatch: (data: any) => {
    logWithTimestamp(`ClaimEvents: Dispatching ${data.type} event`, 'info');
    console.log('ClaimEvents dispatch:', data);
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
  playerId,
  disableEmergencyFallback = false
}: BingoClaimProps) {
  // State for claim checking overlay
  const [isClaimOverlayVisible, setIsClaimOverlayVisible] = useState(false);
  const [claimCheckData, setClaimCheckData] = useState<any>(null);
  
  // State for claim result dialog
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [claimResult, setClaimResult] = useState<'valid' | 'invalid' | null>(null);
  
  // Channels for real-time communication
  const claimCheckingChannelRef = useRef<any>(null);
  const claimResultChannelRef = useRef<any>(null);
  
  // Debug flag to check visibility issues
  const [debugVisibility, setDebugVisibility] = useState(false);
  
  // Reference to track if component is mounted
  const isMountedRef = useRef(true);
  
  // Track last received claim ID to avoid duplicates
  const lastClaimIdRef = useRef<string | null>(null);
  
  // Set up channels for claim checking and results
  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp(`BingoClaim: No session ID provided, not setting up channels`, 'warn');
      return;
    }
    
    logWithTimestamp(`BingoClaim: Setting up channels for session ${sessionId}`, 'info');
    
    // Clear any existing channels first
    if (claimCheckingChannelRef.current) {
      supabase.removeChannel(claimCheckingChannelRef.current);
      claimCheckingChannelRef.current = null;
    }
    
    if (claimResultChannelRef.current) {
      supabase.removeChannel(claimResultChannelRef.current);
      claimResultChannelRef.current = null;
    }
    
    // Set up claim checking channel
    const checkingChannel = supabase
      .channel('claim_checking_broadcaster')
      .on('broadcast', { event: 'claim-checking' }, payload => {
        logWithTimestamp(`BingoClaim: Received claim checking broadcast: ${JSON.stringify(payload.payload)}`, 'info');
        
        // Check if this broadcast is for our session
        if (payload.payload?.sessionId === sessionId) {
          logWithTimestamp(`BingoClaim: Claim checking broadcast matches current session`, 'info');
          
          // Prevent duplicate claims (check claim ID)
          const claimId = payload.payload?.claimId;
          if (claimId && claimId === lastClaimIdRef.current) {
            logWithTimestamp(`BingoClaim: Ignoring duplicate claim with ID ${claimId}`, 'info');
            return;
          }
          
          // Update last claim ID
          lastClaimIdRef.current = claimId;
          
          // Store the payload globally for debugging
          (window as any).lastClaimPayload = payload.payload;
          
          // Set claim data and force visibility to true
          setClaimCheckData(payload.payload);
          setIsClaimOverlayVisible(true);
          setClaimResult(null); // Clear any previous result
          
          // Dispatch to global event system
          claimEvents.dispatch({
            type: 'claim-checking',
            data: payload.payload
          });
          
          // Show toast as a fallback notification only if emergency fallback is not disabled
          if (!disableEmergencyFallback) {
            toast.info(`${payload.payload.playerName || 'A player'} has claimed Bingo! Caller is checking...`, {
              duration: 10000,
              position: 'top-center',
            });
          }
          
          // Verify overlay is visible after a short delay
          setTimeout(() => {
            if (!isMountedRef.current) return;
            
            logWithTimestamp(`BingoClaim: Overlay visibility check: ${isClaimOverlayVisible}`, 'info');
            
            // Check if overlay is truly visible in DOM
            const overlayElement = document.querySelector('.fixed-claim-overlay');
            logWithTimestamp(`BingoClaim: Overlay element exists: ${!!overlayElement}`, 'info');
            
            // If overlay isn't showing, try to force visibility again
            if (!overlayElement) {
              logWithTimestamp(`BingoClaim: Overlay not found in DOM, forcing visibility again`, 'warn');
              setDebugVisibility(true);
              setIsClaimOverlayVisible(true);
              
              // Add overlay directly to body as emergency fallback
              if (!disableEmergencyFallback && !document.querySelector('#emergency-claim-overlay')) {
                const div = document.createElement('div');
                div.id = 'emergency-claim-overlay';
                div.style.position = 'fixed';
                div.style.top = '50%';
                div.style.left = '50%';
                div.style.transform = 'translate(-50%, -50%)';
                div.style.background = 'white';
                div.style.padding = '20px';
                div.style.borderRadius = '8px';
                div.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
                div.style.zIndex = '100001';
                div.innerHTML = `<strong>${payload.payload.playerName || 'A player'}</strong> has claimed Bingo!`;
                document.body.appendChild(div);
                
                setTimeout(() => {
                  if (document.querySelector('#emergency-claim-overlay')) {
                    document.body.removeChild(div);
                  }
                }, 5000);
              }
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
        
        if (!isMountedRef.current) return;
        
        const result = payload.payload;
        
        // Store result globally for debugging
        (window as any).lastClaimResult = result;
        
        // Check if this result is for our session
        if (result.sessionId === sessionId) {
          logWithTimestamp(`BingoClaim: Claim result broadcast matches current session`, 'info');
          
          // If global broadcast or specific to this player
          if (result.isGlobalBroadcast || result.playerId === playerId) {
            const isValidClaim = result.result === 'valid';
            
            // Show appropriate toast notification only if emergency fallback is not disabled
            if (!disableEmergencyFallback) {
              toast(isValidClaim ? 'Bingo Winner!' : 'Claim Rejected', {
                description: isValidClaim 
                  ? `${result.playerName || 'A player'} has won!` 
                  : `The claim by ${result.playerName || 'a player'} was rejected`,
                position: 'top-center',
                duration: 5000
              });
            }
            
            // Dispatch to global event system
            claimEvents.dispatch({
              type: 'claim-result',
              data: result
            });
            
            // Show result dialog
            logWithTimestamp(`BingoClaim: Setting claim result to: ${result.result}`, 'info');
            setClaimResult(result.result);
            setClaimCheckData({
              playerName: result.playerName,
              ticket: result.ticket
            });
            
            // Do not immediately close the overlay - show the result overlay
            // The overlay will auto-close after the animation displays
            
            // Reset claim status if this was our claim and we have the function
            if (result.playerId === playerId && resetClaimStatus) {
              setTimeout(() => {
                if (isMountedRef.current && resetClaimStatus) {
                  resetClaimStatus();
                }
              }, 3000); // Match the auto-close timing
            }
          }
        }
      })
      .subscribe((status) => {
        logWithTimestamp(`BingoClaim: Claim result channel status: ${status}`, 'info');
      });
    
    // Store channels for cleanup
    claimCheckingChannelRef.current = checkingChannel;
    claimResultChannelRef.current = resultChannel;
    
    // Clean up channels on unmount
    return () => {
      isMountedRef.current = false;
      
      if (claimCheckingChannelRef.current) {
        logWithTimestamp(`BingoClaim: Removing claim checking channel during cleanup`, 'info');
        supabase.removeChannel(claimCheckingChannelRef.current);
        claimCheckingChannelRef.current = null;
      }
      
      if (claimResultChannelRef.current) {
        logWithTimestamp(`BingoClaim: Removing claim result channel during cleanup`, 'info');
        supabase.removeChannel(claimResultChannelRef.current);
        claimResultChannelRef.current = null;
      }
    };
  }, [sessionId, playerId, resetClaimStatus, disableEmergencyFallback]);
  
  // Log visibility state changes for debugging
  useEffect(() => {
    logWithTimestamp(`BingoClaim: Visibility states - overlay: ${isClaimOverlayVisible}, result dialog: ${isResultOpen}, debug: ${debugVisibility}`, 'info');
    
    // Add debug method to window for testing
    (window as any).showClaimOverlay = (data: any) => {
      logWithTimestamp('Manually showing claim overlay', 'info');
      setClaimCheckData(data || {
        playerName: 'Test Player',
        ticket: {
          serial: 'TEST1234',
          numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9],
          layoutMask: 110616623,
          calledNumbers: [1, 2, 3]
        },
        winPattern: 'oneLine'
      });
      setIsClaimOverlayVisible(true);
    };
    
    return () => {
      delete (window as any).showClaimOverlay;
    };
  }, [isClaimOverlayVisible, isResultOpen, debugVisibility]);
  
  // Handle closing the overlay
  const handleOverlayClose = () => {
    logWithTimestamp(`BingoClaim: Closing claim overlay`, 'info');
    setIsClaimOverlayVisible(false);
    setClaimResult(null);
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
  
  // Add an effect to insert a claim overlay container into the body if using portal
  useEffect(() => {
    let containerElement: HTMLElement | null = document.getElementById('claim-overlay-container');
    
    if (!containerElement) {
      containerElement = document.createElement('div');
      containerElement.id = 'claim-overlay-container';
      document.body.appendChild(containerElement);
      logWithTimestamp(`BingoClaim: Created claim overlay container in body`, 'info');
    }
    
    return () => {
      // Don't remove it on component cleanup, others might use it
    };
  }, []);
  
  return (
    <>
      {/* Fixed Position Claim Overlay - always included in DOM */}
      <FixedClaimOverlay
        isVisible={isClaimOverlayVisible}
        onClose={handleOverlayClose}
        claimData={claimCheckData}
        validationResult={claimResult}
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
        <div className="fixed bottom-2 left-2 bg-black/80 text-white p-2 text-xs z-[11000] rounded">
          Overlay Visible: {isClaimOverlayVisible.toString()}, Result Dialog: {isResultOpen.toString()}
        </div>
      )}
    </>
  );
}
