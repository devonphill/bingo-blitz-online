
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import ClaimDrawer from './ClaimDrawer';
import { toast } from 'sonner';

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
  // Debugging info
  const instanceId = useRef(`BingoClaim-${Math.random().toString(36).substring(2, 7)}`);
  
  // State for claim checking UI
  const [isClaimSheetVisible, setIsClaimSheetVisible] = useState(false);
  const [claimCheckData, setClaimCheckData] = useState<any>(null);
  const [claimResult, setClaimResult] = useState<'valid' | 'invalid' | null>(null);
  
  // Channels for real-time communication
  const claimCheckingChannelRef = useRef<any>(null);
  const claimResultChannelRef = useRef<any>(null);
  
  // Reference to track if component is mounted
  const isMountedRef = useRef(true);
  
  // Track last received claim ID to avoid duplicates
  const lastClaimIdRef = useRef<string | null>(null);
  
  // Log component lifecycle
  useEffect(() => {
    logWithTimestamp(`BingoClaim (${instanceId.current}): Component mounted - playerName=${playerName}, sessionId=${sessionId || 'none'}, playerId=${playerId || 'none'}`, 'info');
    
    return () => {
      isMountedRef.current = false;
      logWithTimestamp(`BingoClaim (${instanceId.current}): Component unmounting`, 'info');
    };
  }, [playerName, sessionId, playerId]);
  
  // Set up channels for claim checking and results
  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp(`BingoClaim (${instanceId.current}): No session ID provided, not setting up channels`, 'warn');
      return;
    }
    
    logWithTimestamp(`BingoClaim (${instanceId.current}): Setting up channels for session ${sessionId}`, 'info');
    
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
        logWithTimestamp(`BingoClaim (${instanceId.current}): Received claim checking broadcast`, 'info');
        
        // Check if this broadcast is for our session
        if (payload.payload?.sessionId === sessionId) {
          logWithTimestamp(`BingoClaim (${instanceId.current}): Claim checking broadcast matches current session`, 'info');
          
          // Prevent duplicate claims (check claim ID)
          const claimId = payload.payload?.claimId;
          if (claimId && claimId === lastClaimIdRef.current) {
            logWithTimestamp(`BingoClaim (${instanceId.current}): Ignoring duplicate claim with ID ${claimId}`, 'info');
            return;
          }
          
          // Update last claim ID
          lastClaimIdRef.current = claimId;
          
          // Set claim data and force visibility to true
          setClaimCheckData(payload.payload);
          setIsClaimSheetVisible(true);
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
          
          // Debug logs
          logWithTimestamp(`BingoClaim (${instanceId.current}): Set claim sheet visible`, 'info');
          console.log("▶️ CLAIM CHECK DATA SET:", payload.payload);
          console.log("▶️ DRAWER VISIBILITY CHANGED TO:", true);
        }
      })
      .subscribe((status) => {
        logWithTimestamp(`BingoClaim (${instanceId.current}): Claim checking channel status: ${status}`, 'info');
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
        logWithTimestamp(`BingoClaim (${instanceId.current}): Received claim result`, 'info');
        console.log('Received claim result:', payload.payload);
        
        if (!isMountedRef.current) return;
        
        const result = payload.payload;
        
        // Check if this result is for our session
        if (result.sessionId === sessionId) {
          logWithTimestamp(`BingoClaim (${instanceId.current}): Claim result broadcast matches current session`, 'info');
          
          // If global broadcast or specific to this player
          if (result.isGlobalBroadcast || result.playerId === playerId) {
            const isValidClaim = result.result === 'valid';
            
            // Dispatch to global event system
            claimEvents.dispatch({
              type: 'claim-result',
              data: result
            });
            
            // Show result in the drawer
            logWithTimestamp(`BingoClaim (${instanceId.current}): Setting claim result to: ${result.result}`, 'info');
            setClaimResult(result.result);
            setClaimCheckData(prev => ({
              ...prev,
              playerName: result.playerName,
              ticket: result.ticket || prev?.ticket
            }));
            setIsClaimSheetVisible(true);
            
            // Show toast notification as well for better visibility
            toast[isValidClaim ? 'success' : 'error'](
              isValidClaim ? "Bingo Verified!" : "Invalid Claim", 
              { 
                description: `${result.playerName}'s claim was ${isValidClaim ? 'verified' : 'rejected'}`,
                duration: 5000
              }
            );
            
            // Debug logs
            console.log("▶️ CLAIM RESULT SET:", result.result);
            console.log("▶️ DRAWER VISIBILITY CHANGED TO:", true);
            
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
        logWithTimestamp(`BingoClaim (${instanceId.current}): Claim result channel status: ${status}`, 'info');
        console.log('Claim result channel status:', status);
      });
    
    // Store channels for cleanup
    claimCheckingChannelRef.current = checkingChannel;
    claimResultChannelRef.current = resultChannel;
    
    // Debug window method
    (window as any).debugClaimSheet = {
      show: (data: any) => {
        logWithTimestamp('Manually showing claim sheet', 'info');
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
        setIsClaimSheetVisible(true);
        return 'Showing claim sheet';
      },
      hide: () => {
        setIsClaimSheetVisible(false);
        return 'Hiding claim sheet';
      },
      getStatus: () => ({
        visible: isClaimSheetVisible,
        data: claimCheckData,
        result: claimResult
      }),
      forceOpen: (payload: any) => {
        logWithTimestamp(`BingoClaim (${instanceId.current}): Manually forcing drawer open`, 'info');
        const claimData = payload || {
          playerName: 'Test Player',
          ticket: currentTicket || {
            serial: 'TEST1234',
            numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9],
            layoutMask: 110616623,
            calledNumbers: calledNumbers
          },
          sessionId: sessionId,
          winPattern: 'oneLine'
        };
        
        setClaimCheckData(claimData);
        setIsClaimSheetVisible(true);
        return 'Manually opened claim drawer';
      }
    };
    
    // Listen for force open events
    const handleForceOpen = (e: any) => {
      if (e.detail && e.detail.data) {
        logWithTimestamp(`BingoClaim (${instanceId.current}): Received force open event`, 'info');
        (window as any).debugClaimSheet.forceOpen(e.detail.data);
      }
    };
    
    window.addEventListener('forceOpenClaimDrawer', handleForceOpen);
    
    // Clean up channels on unmount
    return () => {
      isMountedRef.current = false;
      
      window.removeEventListener('forceOpenClaimDrawer', handleForceOpen);
      
      if (claimCheckingChannelRef.current) {
        logWithTimestamp(`BingoClaim (${instanceId.current}): Removing claim checking channel during cleanup`, 'info');
        supabase.removeChannel(claimCheckingChannelRef.current);
        claimCheckingChannelRef.current = null;
      }
      
      if (claimResultChannelRef.current) {
        logWithTimestamp(`BingoClaim (${instanceId.current}): Removing claim result channel during cleanup`, 'info');
        supabase.removeChannel(claimResultChannelRef.current);
        claimResultChannelRef.current = null;
      }
      
      delete (window as any).debugClaimSheet;
    };
  }, [sessionId, playerId, resetClaimStatus, calledNumbers, currentTicket, playerName]);
  
  // Handle drawer state changes
  const handleOpenChange = (open: boolean) => {
    logWithTimestamp(`BingoClaim (${instanceId.current}): Drawer open state changed to: ${open}`, 'info');
    setIsClaimSheetVisible(open);
    if (!open) {
      setClaimResult(null);
    }
  };
  
  // This effect will force the drawer to open when claimData changes
  useEffect(() => {
    if (claimCheckData && !isClaimSheetVisible) {
      logWithTimestamp(`BingoClaim (${instanceId.current}): Force opening drawer because claimCheckData exists`, 'info');
      setIsClaimSheetVisible(true);
    }
  }, [claimCheckData, isClaimSheetVisible]);

  return (
    <>
      <ClaimDrawer
        isOpen={isClaimSheetVisible}
        onOpenChange={handleOpenChange}
        playerName={claimCheckData?.playerName || playerName}
        ticketData={claimCheckData?.ticket || currentTicket}
        winPattern={claimCheckData?.winPattern}
        validationResult={claimResult}
      />
    </>
  );
}
