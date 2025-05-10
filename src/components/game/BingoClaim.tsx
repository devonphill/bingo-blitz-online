
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
  
  // Set up channels for claim checking and results
  useEffect(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`BingoClaim: Setting up channels for session ${sessionId}`, 'info');
    
    // Set up claim checking channel
    const checkingChannel = supabase
      .channel('claim_checking_broadcaster')
      .on('broadcast', { event: 'claim-checking' }, payload => {
        logWithTimestamp(`BingoClaim: Received claim checking broadcast: ${JSON.stringify(payload.payload)}`, 'info');
        
        // Check if this broadcast is for our session
        if (payload.payload?.sessionId === sessionId) {
          // Show checking dialog for all players in the session
          setClaimCheckData(payload.payload);
          setIsClaimCheckingOpen(true);
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
            setClaimResult(result.result);
            setClaimCheckData({
              playerName: result.playerName,
              ticket: result.ticket
            });
            setIsResultOpen(true);
            setIsClaimCheckingOpen(false);
            
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
  
  // Handle dialog close events
  const handleCheckingClose = () => {
    setIsClaimCheckingOpen(false);
  };
  
  const handleResultClose = () => {
    setIsResultOpen(false);
    
    // If we have a reset function, call it
    if (resetClaimStatus) {
      resetClaimStatus();
    }
  };
  
  // No visible UI except the dialogs
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
    </>
  );
}
