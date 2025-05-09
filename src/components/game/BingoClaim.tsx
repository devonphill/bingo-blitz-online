
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logWithTimestamp } from '@/utils/logUtils';
import ClaimResultDialog from './ClaimResultDialog';
import { supabase } from '@/integrations/supabase/client';

interface BingoClaimProps {
  onClaimBingo: () => Promise<boolean>;
  claimStatus: 'none' | 'pending' | 'valid' | 'invalid';
  isClaiming: boolean;
  resetClaimStatus?: () => void;
  playerName?: string;
  currentTicket?: any;
  calledNumbers?: number[];
  sessionId?: string | null;
  playerId?: string | null;
}

export default function BingoClaim({
  onClaimBingo,
  claimStatus,
  isClaiming,
  resetClaimStatus,
  playerName = 'Player',
  currentTicket,
  calledNumbers = [],
  sessionId,
  playerId
}: BingoClaimProps) {
  // Track if we need to forcibly reset the claim status
  const [forceResetTimer, setForceResetTimer] = useState<NodeJS.Timeout | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [dialogResult, setDialogResult] = useState<'valid' | 'invalid' | null>(null);
  const [lastClaimTime, setLastClaimTime] = useState(0);
  const [hasReceivedResult, setHasReceivedResult] = useState(false);
  
  // Log when status changes to help with debugging
  useEffect(() => {
    logWithTimestamp(`BingoClaim: Status changed to ${claimStatus}`, 'info');
  }, [claimStatus]);
  
  // Listen for claim result broadcasts
  useEffect(() => {
    if (!playerId && !sessionId) {
      logWithTimestamp(`BingoClaim: No player ID or session ID provided, skipping result listener`, 'warn');
      return;
    }
    
    logWithTimestamp(`BingoClaim: Setting up claim result listener for ${playerId ? `player ${playerId}` : 'session ' + sessionId}`, 'info');
    
    const channel = supabase
      .channel('claim-results-channel')
      .on('broadcast', { event: 'claim-result' }, payload => {
        // Listen for any claim result (our own or others)
        logWithTimestamp(`BingoClaim: Received claim result broadcast: ${JSON.stringify(payload.payload)}`, 'info');
        
        const result = payload.payload?.result;
        const targetPlayerId = payload.payload?.playerId;
        const targetPlayerName = payload.payload?.playerName || 'Unknown Player';
        const targetSessionId = payload.payload?.sessionId;
        const ticket = payload.payload?.ticket;
        
        // Handle all claim results, even from other players
        if (result === 'valid' || result === 'rejected' || result === 'invalid') {
          // Check if it's for our session
          if (sessionId === targetSessionId) {
            // If it's our own claim
            if (playerId === targetPlayerId) {
              const isValid = result === 'valid';
              
              logWithTimestamp(`BingoClaim: Received result for my claim: ${result}`, 'info');
              setDialogResult(isValid ? 'valid' : 'invalid');
              setShowResultDialog(true);
              setHasReceivedResult(true);
              
              // Set the appropriate claim status
              if (resetClaimStatus) {
                setTimeout(() => {
                  resetClaimStatus();
                }, 1000);
              }
            } 
            // If it's someone else's claim, show a toast notification
            else {
              logWithTimestamp(`BingoClaim: Another player's claim result: ${targetPlayerName} - ${result}`);
            }
          }
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, sessionId, resetClaimStatus]);
  
  // Reset claim ability based on status changes
  useEffect(() => {
    logWithTimestamp(`BingoClaim: Status changed to ${claimStatus}`, 'info');
    
    // Clear any existing timer when status changes
    if (forceResetTimer) {
      clearTimeout(forceResetTimer);
      setForceResetTimer(null);
    }
    
    if (claimStatus === 'valid' || claimStatus === 'invalid') {
      // Show the appropriate result dialog if we haven't already
      if (!showResultDialog) {
        setDialogResult(claimStatus === 'valid' ? 'valid' : 'invalid');
        setShowResultDialog(true);
      }
      
      // After a delay, allow claiming again
      const timer = setTimeout(() => {
        if (resetClaimStatus) {
          logWithTimestamp(`BingoClaim: Automatically resetting claim status from: ${claimStatus} to none`, 'info');
          resetClaimStatus();
          setShowResultDialog(false);
        }
      }, 5000); // 5 second timeout for showing claim result
      
      setForceResetTimer(timer);
      return () => clearTimeout(timer);
    } else if (claimStatus === 'pending') {
      // Safety fallback: if we've been in 'pending' state too long, reset
      const timer = setTimeout(() => {
        if (resetClaimStatus) {
          logWithTimestamp(`BingoClaim: Force resetting stale pending claim after timeout`, 'warn');
          resetClaimStatus();
        }
      }, 15000); // 15 second safety timeout
      
      setForceResetTimer(timer);
      return () => clearTimeout(timer);
    }
  }, [claimStatus, resetClaimStatus, forceResetTimer, showResultDialog]);

  // ENHANCED: Add a fallback reset mechanism
  useEffect(() => {
    // This handles race conditions where state might get stuck
    const fallbackTimer = setTimeout(() => {
      if ((claimStatus === 'pending' && !isClaiming) || 
          (isClaiming && Date.now() - lastClaimTime > 20000)) {
        logWithTimestamp(`BingoClaim: Fallback reset triggered for stuck state: ${claimStatus}`, 'warn');
        if (resetClaimStatus) resetClaimStatus();
      }
    }, 25000); // Very last resort fallback
    
    return () => clearTimeout(fallbackTimer);
  }, [claimStatus, isClaiming, resetClaimStatus, lastClaimTime]);
  
  const handleClick = async () => {
    try {
      setLastClaimTime(Date.now());
      logWithTimestamp("BingoClaim: Submitting bingo claim");
      setHasReceivedResult(false);
      await onClaimBingo();
    } catch (error) {
      console.error("Error claiming bingo:", error);
      logWithTimestamp(`BingoClaim: Error during claim: ${error}`, 'error');
      
      // Auto-reset on error after a short delay
      setTimeout(() => {
        if (resetClaimStatus) {
          logWithTimestamp(`BingoClaim: Resetting after error`, 'info');
          resetClaimStatus();
        }
      }, 3000);
    }
  };
  
  const handleCloseResultDialog = () => {
    logWithTimestamp(`BingoClaim: Closing result dialog`, 'info');
    setShowResultDialog(false);
    if (resetClaimStatus) {
      resetClaimStatus();
    }
  };
  
  // Render different button states based on claim status
  const renderButton = () => {
    switch (claimStatus) {
      case 'pending':
        return (
          <Button
            disabled
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600"
          >
            <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent" />
            <span>Verifying...</span>
          </Button>
        );
        
      case 'valid':
        return (
          <Button 
            disabled
            className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Bingo Verified!</span>
          </Button>
        );
        
      case 'invalid':
        return (
          <Button 
            disabled
            className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
          >
            <XCircle className="h-4 w-4" />
            <span>Invalid Claim</span>
          </Button>
        );
        
      default:
        return (
          <Button
            onClick={handleClick}
            disabled={isClaiming}
            className={cn(
              "bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary flex items-center gap-2",
              isClaiming && "opacity-70 cursor-not-allowed"
            )}
          >
            {isClaiming ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent" />
                <span>Claiming...</span>
              </>
            ) : (
              <>
                <Trophy className="h-5 w-5" />
                <span>BINGO!</span>
              </>
            )}
          </Button>
        );
    }
  };

  // Prepare ticket data for the result dialog
  const ticketForDialog = currentTicket ? {
    serial: currentTicket.serial || '',
    numbers: currentTicket.numbers || [],
    calledNumbers: calledNumbers || []
  } : undefined;

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-xs">
        {renderButton()}
      </div>
      
      <ClaimResultDialog
        isOpen={showResultDialog}
        onClose={handleCloseResultDialog}
        result={dialogResult}
        playerName={playerName}
        ticket={ticketForDialog}
      />
    </div>
  );
}
