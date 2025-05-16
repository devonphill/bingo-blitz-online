import React, { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from 'lucide-react';
import { logWithTimestamp } from '@/utils/logUtils';
import { useCallerClaimManagement } from '@/hooks/useCallerClaimManagement';
import { usePatternProgression } from '@/hooks/usePatternProgression';
import ClaimsList from './ClaimsList';
import { ClaimData } from '@/types/claim';
import { claimBroadcastService } from '@/services/ClaimBroadcastService';

interface ClaimVerificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  gameNumber?: number;
  currentCalledNumbers?: number[];
  gameType?: string;
  currentNumber?: number | null;
  currentWinPattern?: string | null;
  onGameProgress?: () => void;
}

export default function ClaimVerificationSheet({
  isOpen,
  onClose,
  sessionId,
  gameNumber,
  currentCalledNumbers = [],
  gameType = 'mainstage',
  currentNumber,
  currentWinPattern,
  onGameProgress
}: ClaimVerificationSheetProps) {
  // Use the improved claim management hook
  const { 
    claims, 
    processClaim, 
    fetchClaims,
    forceRefresh,
    isLoading
  } = useCallerClaimManagement(sessionId || null);
  
  const { toast } = useToast();
  const [autoClose, setAutoClose] = useState(true);
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);

  // Use the pattern progression hook with all its new capabilities
  const { 
    findNextWinPattern, 
    progressToNextPattern, 
    isLastPattern,
    getActivePatterns,
    progressToNextGame
  } = usePatternProgression(sessionId || null);

  // Debug log when sheet is opened/closed
  useEffect(() => {
    logWithTimestamp(`ClaimVerificationSheet: isOpen=${isOpen}`, 'info');
    if (isOpen) {
      logWithTimestamp(`Session ID: ${sessionId}`, 'info');
      logWithTimestamp(`Claims count: ${claims?.length || 0}`, 'info');
      
      if (claims?.length > 0) {
        claims.forEach((claim, idx) => {
          logWithTimestamp(`Claim ${idx+1}: ID=${claim.id}, Player=${claim.playerName || claim.playerId}`, 'info');
        });
      } else {
        logWithTimestamp('No claims found in state', 'warn');
      }
    }
  }, [isOpen, sessionId, claims]);

  // Fetch claims on open
  useEffect(() => {
    if (isOpen && sessionId) {
      logWithTimestamp(`ClaimVerificationSheet: Fetching claims for session ${sessionId}`);
      fetchClaims();
    }
  }, [isOpen, sessionId, fetchClaims]);
  
  // Function to broadcast claim checking to all players
  const broadcastClaimChecking = useCallback(async (claim: ClaimData) => {
    if (!sessionId || !claim) return false;
    
    try {
      logWithTimestamp(`ClaimVerificationSheet: Broadcasting claim check for ${claim.playerName || claim.playerId}`, 'info');
      
      // Add current called numbers to claim
      const claimWithNumbers = {
        ...claim,
        calledNumbers: currentCalledNumbers,
        lastCalledNumber: currentNumber,
        sessionId: sessionId,
        gameType: gameType,
        winPattern: currentWinPattern
      };
      
      // Use the broadcast service to send the claim checking broadcast
      const success = await claimBroadcastService.broadcastClaimChecking(
        claimWithNumbers,
        sessionId
      );
      
      if (success) {
        toast({
          title: "Broadcast Sent",
          description: `Claim check broadcast sent to all players for ${claim.playerName || claim.playerId}`,
          duration: 3000
        });
        return true;
      } else {
        toast({
          title: "Broadcast Failed",
          description: "Failed to send claim check broadcast",
          variant: "destructive",
          duration: 5000
        });
        return false;
      }
    } catch (err) {
      console.error("Error broadcasting claim check:", err);
      toast({
        title: "Broadcast Error",
        description: "An error occurred while broadcasting the claim check",
        variant: "destructive",
        duration: 5000
      });
      return false;
    }
  }, [sessionId, currentCalledNumbers, currentNumber, gameType, currentWinPattern, toast]);
  
  // Handle verifying a claim
  const handleVerify = useCallback(async (claim: ClaimData) => {
    if (!claim || !sessionId) {
      logWithTimestamp(`ClaimVerificationSheet: Cannot verify null claim or no sessionId`, 'error');
      return;
    }
    
    logWithTimestamp(`ClaimVerificationSheet: Verifying claim: ${claim.id}`, 'info');
    setIsProcessingClaim(true);
    
    try {
      // First, broadcast that we are checking this claim to all players
      await broadcastClaimChecking(claim);
      
      // Wait a bit to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Then, validate the claim
      const success = await processClaim(claim, true);
      
      if (success) {
        // Get active patterns for current game
        const activePatterns = await getActivePatterns(gameNumber);
        
        // Check if this was the final pattern
        const finalPattern = await isLastPattern(currentWinPattern || null, gameNumber);
        
        logWithTimestamp(`Pattern check: currentWinPattern=${currentWinPattern}, isLastPattern=${finalPattern}`, 'info');
        
        // If not the final pattern, try to progress to the next pattern
        if (!finalPattern) {
          const nextPattern = await findNextWinPattern(currentWinPattern || null, gameNumber);
          
          if (nextPattern && sessionId) {
            // Progress to the next pattern
            await progressToNextPattern(nextPattern, sessionId);
            
            toast({
              title: "Pattern Completed",
              description: `Moving to next pattern: ${nextPattern.id}`,
              duration: 3000,
            });
          }
        }
        // If it was the final pattern, progress to the next game
        else {
          logWithTimestamp(`This was the final pattern - advancing to next game`, 'info');
          
          // Progress to next game
          const gameProgressSuccess = await progressToNextGame(gameNumber || 1);
          
          // If game progression was successful, show notification
          if (gameProgressSuccess) {
            toast({
              title: "Game Completed",
              description: "Advancing to next game...",
              duration: 5000,
            });
            
            // Always call the onGameProgress callback if provided
            if (onGameProgress) {
              // Use a timeout to ensure UI updates first
              setTimeout(() => {
                logWithTimestamp(`Triggering onGameProgress callback`, 'info');
                onGameProgress();
              }, 1500);
            }
          }
        }
        
        toast({
          title: "Claim Verified",
          description: `The claim by ${claim.playerName || claim.playerId} has been verified successfully.`,
          duration: 3000,
        });
        
        // Refresh claims to update UI
        fetchClaims();
        
        // If no claims left and autoClose is enabled, close the sheet after a short delay
        setTimeout(() => {
          const remainingClaims = claims.filter(c => c.id !== claim.id);
          if (remainingClaims.length === 0 && autoClose) {
            onClose();
          }
        }, 1500);
      }
    } catch (err) {
      console.error("Error during claim verification:", err);
      toast({
        title: "Error",
        description: "Failed to process claim verification",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsProcessingClaim(false);
    }
  }, [
    processClaim, 
    toast, 
    fetchClaims, 
    claims, 
    onClose, 
    autoClose, 
    sessionId, 
    gameNumber,
    currentWinPattern, 
    findNextWinPattern,
    progressToNextPattern,
    isLastPattern,
    getActivePatterns,
    progressToNextGame,
    onGameProgress,
    broadcastClaimChecking
  ]);
  
  // Handle rejecting a claim
  const handleReject = useCallback(async (claim: ClaimData) => {
    if (!claim) {
      logWithTimestamp(`ClaimVerificationSheet: Cannot reject null claim`, 'error');
      return;
    }
    
    logWithTimestamp(`ClaimVerificationSheet: Rejecting claim: ${claim.id}`, 'info');
    setIsProcessingClaim(true);
    
    try {
      const success = await processClaim(claim, false);
      
      if (success) {
        toast({
          title: "Claim Rejected",
          description: `The claim by ${claim.playerName || claim.playerId} has been rejected.`,
          duration: 3000,
        });
        
        // Refresh claims to update UI
        fetchClaims();
      }
    } catch (err) {
      console.error("Error rejecting claim:", err);
      toast({
        title: "Error",
        description: "Failed to reject claim",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsProcessingClaim(false);
    }
  }, [processClaim, toast, fetchClaims]);

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`Manually refreshing claims for session ${sessionId}`, 'info');
    forceRefresh();
    toast({
      title: "Claims Refreshed",
      description: "Claim list has been manually refreshed",
      duration: 2000,
    });
  }, [sessionId, forceRefresh, toast]);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Claim Verification</SheetTitle>
          <SheetDescription>
            Review and validate bingo claims.
          </SheetDescription>
        </SheetHeader>
        
        <div className="grid gap-4 py-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {claims && claims.length > 0 
                ? `${claims.length} pending claims` 
                : 'No pending claims'}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1"
              onClick={handleRefresh}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Claims
            </Button>
          </div>
          
          <div className="flex items-center justify-end mb-2">
            <label className="text-sm mr-2">Auto-close after verification:</label>
            <input 
              type="checkbox" 
              checked={autoClose} 
              onChange={(e) => setAutoClose(e.target.checked)} 
              className="rounded"
            />
          </div>
          
          <ClaimsList
            claims={claims as ClaimData[] || []} // Fixed: Type cast to ensure compatibility with ClaimData[]
            currentCalledNumbers={currentCalledNumbers}
            currentNumber={currentNumber}
            gameType={gameType}
            currentWinPattern={currentWinPattern || null}
            onVerify={handleVerify}
            onReject={handleReject}
            isProcessingClaim={isProcessingClaim}
            onRefresh={handleRefresh}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
