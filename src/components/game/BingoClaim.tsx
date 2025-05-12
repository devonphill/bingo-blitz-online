
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import ClaimOverlayPortal from './ClaimOverlayPortal';
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
  playerId
}: BingoClaimProps) {
  // State for claim checking overlay
  const [isClaimOverlayVisible, setIsClaimOverlayVisible] = useState(false);
  const [claimCheckData, setClaimCheckData] = useState<any>(null);
  const [claimResult, setClaimResult] = useState<'valid' | 'invalid' | null>(null);
  
  // Channels for real-time communication
  const claimCheckingChannelRef = useRef<any>(null);
  const claimResultChannelRef = useRef<any>(null);
  
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
    
    // Set up claim checking channel with improved configuration
    const checkingChannel = supabase
      .channel('claim_checking_broadcaster', {
        config: {
          broadcast: { 
            self: true, // Ensure we receive our own broadcasts 
            ack: true // Request acknowledgment for debugging
          }
        }
      })
      .on('broadcast', { event: 'claim-checking' }, payload => {
        console.log('Received claim checking broadcast:', payload);
        logWithTimestamp(`BingoClaim: Received claim checking broadcast`, 'info');
        
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
          
          // Set claim data and force visibility to true
          setClaimCheckData(payload.payload);
          setIsClaimOverlayVisible(true);
          setClaimResult(null); // Clear any previous result
          
          // Show toast notification for better visibility
          toast.info("Bingo Claim Being Checked", {
            description: `${payload.payload.playerName || 'Player'}'s ticket is being verified`,
            duration: 4000
          });
          
          // Dispatch to global event system
          claimEvents.dispatch({
            type: 'claim-checking',
            data: payload.payload
          });
        }
      })
      .subscribe((status) => {
        logWithTimestamp(`BingoClaim: Claim checking channel status: ${status}`, 'info');
        console.log('Claim checking channel status:', status);
      });
    
    // Set up claim result channel
    const resultChannel = supabase
      .channel('game-updates', {
        config: {
          broadcast: { self: true } // Ensure we receive our own broadcasts
        }
      })
      .on('broadcast', { event: 'claim-result' }, payload => {
        logWithTimestamp(`BingoClaim: Received claim result`, 'info');
        console.log('Received claim result:', payload.payload);
        
        if (!isMountedRef.current) return;
        
        const result = payload.payload;
        
        // Check if this result is for our session
        if (result.sessionId === sessionId) {
          logWithTimestamp(`BingoClaim: Claim result broadcast matches current session`, 'info');
          
          // If global broadcast or specific to this player
          if (result.isGlobalBroadcast || result.playerId === playerId) {
            const isValidClaim = result.result === 'valid';
            
            // Dispatch to global event system
            claimEvents.dispatch({
              type: 'claim-result',
              data: result
            });
            
            // Show result in the portal
            logWithTimestamp(`BingoClaim: Setting claim result to: ${result.result}`, 'info');
            setClaimResult(result.result);
            setClaimCheckData({
              playerName: result.playerName,
              ticket: result.ticket
            });
            setIsClaimOverlayVisible(true);
            
            // Show toast notification as well for better visibility
            toast[isValidClaim ? 'success' : 'error'](
              isValidClaim ? "Bingo Verified!" : "Invalid Claim", 
              { 
                description: `${result.playerName}'s claim was ${isValidClaim ? 'verified' : 'rejected'}`,
                duration: 5000
              }
            );
            
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
        console.log('Claim result channel status:', status);
      });
    
    // Store channels for cleanup
    claimCheckingChannelRef.current = checkingChannel;
    claimResultChannelRef.current = resultChannel;
    
    // Create portal container in body at mount time
    const portalContainer = document.getElementById('portal-claim-overlay') || document.createElement('div');
    if (!portalContainer.id) {
      portalContainer.id = 'portal-claim-overlay';
      document.body.appendChild(portalContainer);
      console.log('Created portal container for claims');
    }
    
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
  }, [sessionId, playerId, resetClaimStatus]);
  
  // Log visibility state changes for debugging
  useEffect(() => {
    logWithTimestamp(`BingoClaim: Overlay visibility state: ${isClaimOverlayVisible}, result: ${claimResult || 'none'}`, 'info');
    console.log(`Claim overlay visibility: ${isClaimOverlayVisible}, result: ${claimResult || 'none'}`);
    
    // Add debug method to window for testing
    (window as any).debugClaimOverlay = {
      show: (data: any) => {
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
        return 'Showing claim overlay';
      },
      hide: () => {
        setIsClaimOverlayVisible(false);
        return 'Hiding claim overlay';
      },
      getStatus: () => ({
        visible: isClaimOverlayVisible,
        data: claimCheckData,
        result: claimResult
      })
    };
    
    return () => {
      delete (window as any).debugClaimOverlay;
    };
  }, [isClaimOverlayVisible, claimResult, claimCheckData]);
  
  // Handle closing the overlay
  const handleOverlayClose = () => {
    logWithTimestamp(`BingoClaim: Closing claim overlay`, 'info');
    setIsClaimOverlayVisible(false);
    setClaimResult(null);
  };
  
  return (
    <>
      {/* Portal-based Claim Overlay */}
      <ClaimOverlayPortal
        isOpen={isClaimOverlayVisible}
        onClose={handleOverlayClose}
        playerName={claimCheckData?.playerName || playerName}
        ticketData={claimCheckData?.ticket || currentTicket}
        winPattern={claimCheckData?.winPattern}
        validationResult={claimResult}
      />
    </>
  );
}
