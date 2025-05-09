
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
    validateClaim, 
    isProcessingClaim,
    fetchClaims,
    forceRefresh
  } = useCallerClaimManagement(sessionId || null);
  
  const { toast } = useToast();
  const [autoClose, setAutoClose] = useState(true);

  // Use the pattern progression hook
  const { findNextWinPattern, progressToNextPattern } = usePatternProgression(sessionId || null);

  // Debug log when sheet is opened/closed
  useEffect(() => {
    logWithTimestamp(`ClaimVerificationSheet: isOpen=${isOpen}`, 'info');
    if (isOpen) {
      logWithTimestamp(`Session ID: ${sessionId}`, 'info');
      logWithTimestamp(`Claims count: ${claims?.length || 0}`, 'info');
      logWithTimestamp(`Current win pattern: ${currentWinPattern}`, 'info');
      logWithTimestamp(`Current game number: ${gameNumber}`, 'info');
      if (claims?.length > 0) {
        logWithTimestamp(`First claim: ${JSON.stringify(claims[0])}`, 'debug');
      }
    }
  }, [isOpen, sessionId, claims, currentWinPattern, gameNumber]);

  // Fetch claims on open
  useEffect(() => {
    if (isOpen && sessionId) {
      logWithTimestamp(`ClaimVerificationSheet: Fetching claims for session ${sessionId}`);
      fetchClaims();
    }
  }, [isOpen, sessionId, fetchClaims]);
  
  // Handle verifying a claim
  const handleVerify = useCallback(async (claim: ClaimData) => {
    if (!claim) {
      logWithTimestamp(`ClaimVerificationSheet: Cannot verify null claim`, 'error');
      return;
    }
    
    logWithTimestamp(`ClaimVerificationSheet: Verifying claim: ${claim.id}`, 'info');
    
    // Pass onGameProgress callback if it exists for game progression
    const success = await validateClaim(claim, true, onGameProgress);
    
    if (success) {
      // After successful validation, update the current win pattern
      // but only if we have more patterns to progress to
      const nextPattern = await findNextWinPattern(currentWinPattern || null, gameNumber);
      
      if (nextPattern && sessionId) {
        // Progress to the next pattern
        await progressToNextPattern(nextPattern, sessionId);
      } else {
        logWithTimestamp(`No next pattern found or this was the final pattern`, 'info');
      }
      
      toast({
        title: "Claim Verified",
        description: `The claim by ${claim.playerName} has been verified successfully.`,
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
  }, [validateClaim, toast, fetchClaims, claims, onClose, autoClose, sessionId, findNextWinPattern, progressToNextPattern, currentWinPattern, gameNumber, onGameProgress]);
  
  // Handle rejecting a claim
  const handleReject = useCallback(async (claim: ClaimData) => {
    if (!claim) {
      logWithTimestamp(`ClaimVerificationSheet: Cannot reject null claim`, 'error');
      return;
    }
    
    logWithTimestamp(`ClaimVerificationSheet: Rejecting claim: ${claim.id}`, 'info');
    const success = await validateClaim(claim, false);
    
    if (success) {
      toast({
        title: "Claim Rejected",
        description: `The claim by ${claim.playerName} has been rejected.`,
        duration: 3000,
      });
      
      // Refresh claims to update UI
      fetchClaims();
    }
  }, [validateClaim, toast, fetchClaims]);

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
            claims={claims || []}
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
