
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import ClaimCheckingDialog from './ClaimCheckingDialog';
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
  // State for claim checking dialog
  const [isClaimCheckingOpen, setIsClaimCheckingOpen] = useState(false);
  const [claimCheckData, setClaimCheckData] = useState<any>(null);
  
  // State for claim result dialog
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [claimResult, setClaimResult] = useState<'valid' | 'invalid' | null>(null);
  
  // Channels for real-time communication
  const [claimCheckingChannel, setClaimCheckingChannel] = useState<any>(null);
  const [claimResultChannel, setClaimResultChannel] = useState<any>(null);
  
  // Debug flag to check dialog visibility issues
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
          
          // Show checking dialog for all players in the session
          setClaimCheckData(payload.payload);
          
          // Force dialog to open and log the state change attempt
          logWithTimestamp(`BingoClaim: Attempting to open claim checking dialog`, 'info');
          setIsClaimCheckingOpen(true);
          
          // Add a timeout to verify state update
          setTimeout(() => {
            logWithTimestamp(`BingoClaim: Dialog open state after update: ${isClaimCheckingOpen}`, 'info');
            
            // If dialog isn't showing, try to force visibility
            if (!isClaimCheckingOpen) {
              logWithTimestamp(`BingoClaim: Dialog not showing after state update, trying force visibility`, 'warn');
              setDebugVisibility(true);
              setIsClaimCheckingOpen(true);
            }
          }, 100);
          
          // Show toast as a fallback notification
          toast.info(`${payload.payload.playerName || 'A player'} has claimed Bingo! Caller is checking...`, {
            duration: 5000,
            position: 'top-center',
          });
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
            
            // Show result dialog
            logWithTimestamp(`BingoClaim: Opening claim result dialog with status: ${result.result}`, 'info');
            setClaimResult(result.result);
            setClaimCheckData({
              playerName: result.playerName,
              ticket: result.ticket
            });
            
            // Close checking dialog and open result dialog
            setIsClaimCheckingOpen(false);
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
  
  // Log dialog state changes for debugging
  useEffect(() => {
    logWithTimestamp(`BingoClaim: Dialog states updated - checking: ${isClaimCheckingOpen}, result: ${isResultOpen}`, 'info');
    
    // Add DOM check to verify dialog exists and is visible
    if (isClaimCheckingOpen || isResultOpen) {
      setTimeout(() => {
        const dialogElements = document.querySelectorAll('[role="dialog"]');
        logWithTimestamp(`BingoClaim: Found ${dialogElements.length} dialog elements in DOM`, 'info');
        
        dialogElements.forEach((el, i) => {
          const isVisible = window.getComputedStyle(el).display !== 'none' && 
                           window.getComputedStyle(el).visibility !== 'hidden';
          logWithTimestamp(`BingoClaim: Dialog #${i} visible=${isVisible}, z-index=${window.getComputedStyle(el).zIndex}`, 'info');
        });
      }, 200);
    }
  }, [isClaimCheckingOpen, isResultOpen]);
  
  // Handle dialog close events
  const handleCheckingClose = () => {
    logWithTimestamp(`BingoClaim: Closing claim checking dialog`, 'info');
    setIsClaimCheckingOpen(false);
  };
  
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
      <ClaimCheckingDialog
        isOpen={isClaimCheckingOpen}
        onClose={handleCheckingClose}
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
      
      {/* Debug element to show dialog state */}
      {debugVisibility && (
        <div className="fixed bottom-2 left-2 bg-black/80 text-white p-2 text-xs z-[2000] rounded">
          Dialog States: Checking={isClaimCheckingOpen.toString()}, Result={isResultOpen.toString()}
        </div>
      )}
    </>
  );
}
