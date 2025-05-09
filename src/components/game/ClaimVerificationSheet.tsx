
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
import { CheckCircle, XCircle, Loader, RefreshCw } from 'lucide-react';
import { logWithTimestamp } from '@/utils/logUtils';
import CallerTicketDisplay from './CallerTicketDisplay';
import { useCallerClaimManagement } from '@/hooks/useCallerClaimManagement';
import { supabase } from '@/integrations/supabase/client';

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
    fetchClaims
  } = useCallerClaimManagement(sessionId || null);
  
  const { toast } = useToast();
  const [autoClose, setAutoClose] = useState(true);

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
  
  // Find the next win pattern after the current one
  const findNextWinPattern = useCallback(async () => {
    if (!sessionId || !gameNumber) return null;
    
    try {
      logWithTimestamp(`Finding next win pattern after ${currentWinPattern} for game ${gameNumber}`, 'info');
      
      const { data: gameSessionData, error: fetchError } = await supabase
        .from('game_sessions')
        .select('games_config')
        .eq('id', sessionId)
        .single();
        
      if (fetchError) {
        console.error("Error fetching game config:", fetchError);
        return null;
      }
      
      if (!gameSessionData?.games_config) {
        logWithTimestamp(`No game configs found for session ${sessionId}`, 'warn');
        return null;
      }
      
      // Parse game configs if needed
      const configs = typeof gameSessionData.games_config === 'string'
        ? JSON.parse(gameSessionData.games_config)
        : gameSessionData.games_config;
        
      // Find config for current game
      const currentConfig = configs.find((config: any) => 
        config.gameNumber === gameNumber || config.game_number === gameNumber
      );
      
      if (!currentConfig || !currentConfig.patterns) {
        logWithTimestamp(`No pattern config found for game ${gameNumber}`, 'warn');
        return null;
      }
      
      // Get all active patterns
      const activePatterns = Object.entries(currentConfig.patterns)
        .filter(([_, pattern]: [string, any]) => pattern.active === true)
        .map(([id, pattern]: [string, any]) => ({
          id,
          ...pattern
        }));
      
      logWithTimestamp(`Found ${activePatterns.length} active patterns: ${activePatterns.map(p => p.id).join(', ')}`, 'info');
      
      // If no currentWinPattern, return the first active pattern
      if (!currentWinPattern && activePatterns.length > 0) {
        return activePatterns[0];
      }
      
      // Find index of current pattern
      const currentIndex = activePatterns.findIndex(p => p.id === currentWinPattern);
      if (currentIndex < 0 || currentIndex >= activePatterns.length - 1) {
        logWithTimestamp(`Current pattern is the last one or not found: ${currentWinPattern}`, 'info');
        return null; // No next pattern
      }
      
      // Return next pattern
      const nextPattern = activePatterns[currentIndex + 1];
      logWithTimestamp(`Found next pattern: ${nextPattern.id}`, 'info');
      return nextPattern;
      
    } catch (error) {
      console.error("Error finding next win pattern:", error);
      return null;
    }
  }, [sessionId, gameNumber, currentWinPattern]);
  
  // Handle verifying a claim
  const handleVerify = useCallback(async (claim: any) => {
    if (!claim) return;
    
    logWithTimestamp(`Verifying claim: ${JSON.stringify(claim)}`, 'info');
    
    // We'll pass onGameProgress callback if it exists for game progression
    const success = await validateClaim(claim, true, onGameProgress);
    
    if (success) {
      // After successful validation, update the current win pattern
      // but only if we have more patterns to progress to
      const nextPattern = await findNextWinPattern();
      
      if (nextPattern && sessionId) {
        logWithTimestamp(`Progressing to next pattern: ${nextPattern.id}, prize: ${nextPattern.prizeAmount}, description: ${nextPattern.description}`, 'info');
        
        // Update session progress with next pattern
        const { error: updateError } = await supabase
          .from('sessions_progress')
          .update({
            current_win_pattern: nextPattern.id,
            current_prize: nextPattern.prizeAmount || '10.00',
            current_prize_description: nextPattern.description || `${nextPattern.id} Prize`
          })
          .eq('session_id', sessionId);
          
        if (updateError) {
          console.error("Error updating win pattern:", updateError);
          logWithTimestamp(`Error updating to next pattern: ${updateError.message}`, 'error');
        } else {
          logWithTimestamp(`Successfully updated to next pattern: ${nextPattern.id}`, 'info');
          
          // Broadcast pattern change for realtime update
          try {
            const broadcastChannel = supabase.channel('pattern-updates');
            await broadcastChannel.send({
              type: 'broadcast',
              event: 'pattern-changed',
              payload: {
                sessionId: sessionId,
                winPattern: nextPattern.id,
                prize: nextPattern.prizeAmount,
                prizeDescription: nextPattern.description
              }
            });
          } catch (err) {
            console.error("Error broadcasting pattern update:", err);
          }
        }
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
  }, [validateClaim, toast, fetchClaims, claims, onClose, autoClose, sessionId, findNextWinPattern, onGameProgress]);
  
  // Handle rejecting a claim
  const handleReject = useCallback(async (claim: any) => {
    if (!claim) return;
    
    logWithTimestamp(`Rejecting claim: ${JSON.stringify(claim)}`, 'info');
    const success = await validateClaim(claim, false);
    
    if (success) {
      toast({
        title: "Claim Rejected",
        description: `The claim by ${claim.playerName} has been rejected.`,
        duration: 3000, // Reduced to 3 seconds
      });
      
      // Refresh claims to update UI
      fetchClaims();
    }
  }, [validateClaim, toast, fetchClaims]);

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`Manually refreshing claims for session ${sessionId}`, 'info');
    fetchClaims();
    toast({
      title: "Refreshed",
      description: "Claim list has been refreshed",
      duration: 2000, // Even shorter for this minor notification
    });
  }, [sessionId, fetchClaims, toast]);

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
          
          {claims?.length === 0 ? (
            <div className="text-center text-gray-500 p-8">
              <p className="mb-2">No claims to review at this time.</p>
              <p className="text-sm text-muted-foreground mb-4">
                Claims will appear here automatically when players submit them.
              </p>
            </div>
          ) : (
            claims?.map((claim, index) => (
              <div key={claim.id || index} className="border rounded-md p-4">
                <div className="font-bold">Claim Details</div>
                <div>Player: {claim.playerName || claim.playerId}</div>
                <div>Session: {claim.sessionId?.substring(0, 8)}...</div>
                <div>Game: {claim.gameNumber || gameNumber}</div>
                <div>Pattern: {claim.winPattern || currentWinPattern}</div>
                <div>Claimed at: {new Date(claim.claimedAt).toLocaleTimeString()}</div>
                
                {claim.toGoCount !== undefined && (
                  <div className="mt-2 bg-yellow-50 p-2 rounded">
                    <span className="font-semibold">Ticket Status: </span>
                    {claim.toGoCount === 0 ? (
                      <span className="text-green-600 font-bold">Complete (0TG)</span>
                    ) : claim.toGoCount < 0 ? (
                      <span className="text-orange-600 font-bold">Missed claim ({-claim.toGoCount} numbers ago)</span>
                    ) : (
                      <span className="text-red-600 font-bold">{claim.toGoCount} numbers to go</span>
                    )}
                    {claim.hasLastCalledNumber && (
                      <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                        Has last called number
                      </span>
                    )}
                  </div>
                )}
                
                {/* Display the ticket information */}
                {claim.ticket && (
                  <div className="mt-4 border-t pt-3">
                    <h3 className="font-medium text-sm mb-2">Claimed Ticket:</h3>
                    <CallerTicketDisplay
                      ticket={{
                        numbers: claim.ticket.numbers,
                        layoutMask: claim.ticket.layoutMask,
                        serial: claim.ticket.serial || "Unknown",
                        perm: claim.ticket.perm,
                        position: claim.ticket.position
                      }}
                      calledNumbers={currentCalledNumbers || claim.calledNumbers || []}
                      lastCalledNumber={currentNumber || claim.lastCalledNumber}
                      gameType={gameType}
                      winPattern={currentWinPattern || claim.winPattern}
                    />
                  </div>
                )}
                
                <div className="flex justify-end gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => handleVerify(claim)}
                    disabled={isProcessingClaim}
                    className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                  >
                    {isProcessingClaim ? (
                      <Loader className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Verify
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleReject(claim)}
                    disabled={isProcessingClaim}
                    className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                  >
                    {isProcessingClaim ? (
                      <Loader className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
