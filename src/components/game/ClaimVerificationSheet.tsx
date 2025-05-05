
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
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { logWithTimestamp } from '@/utils/logUtils';
import CallerTicketDisplay from './CallerTicketDisplay';
import { useCallerClaimManagement } from '@/hooks/useCallerClaimManagement';
import { useNetwork } from '@/contexts/NetworkStatusContext';

interface ClaimVerificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  gameNumber?: number;
  currentCalledNumbers?: number[];
  gameType?: string;
  playerName?: string;
  currentNumber?: number | null;
  currentWinPattern?: string | null;
}

export default function ClaimVerificationSheet({
  isOpen,
  onClose,
  sessionId,
  gameNumber,
  currentCalledNumbers = [],
  gameType = 'mainstage',
  playerName,
  currentNumber,
  currentWinPattern
}: ClaimVerificationSheetProps) {
  // Use the claim management hook for handling claims
  const { 
    claims, 
    validateClaim, 
    isProcessingClaim 
  } = useCallerClaimManagement(sessionId || null);
  
  const { toast } = useToast();
  
  // Use the network context
  const network = useNetwork();
  
  // Force fetch claims when sheet opens
  useEffect(() => {
    if (isOpen && sessionId) {
      logWithTimestamp(`Fetching latest claims for session ${sessionId}`);
      try {
        // Fetch claims directly using the network context
        network.fetchClaims(sessionId)
          .then(claims => {
            logWithTimestamp(`Found ${claims?.length || 0} pending claims`);
          })
          .catch(e => {
            console.error('Exception fetching claims:', e);
          });
      } catch (e) {
        console.error('Exception fetching claims:', e);
      }
    }
  }, [isOpen, network, sessionId]);
  
  // Handle verifying a claim
  const handleVerify = useCallback((claim: any) => {
    if (!claim) return;
    
    logWithTimestamp(`Verifying claim: ${claim.id}`);
    
    // Use the validateClaim function from the hook
    validateClaim(claim, true);
  }, [validateClaim]);
  
  // Handle rejecting a claim
  const handleReject = useCallback((claim: any) => {
    if (!claim) return;
    
    logWithTimestamp(`Rejecting claim: ${claim.id}`);
    
    // Use the validateClaim function from the hook
    validateClaim(claim, false);
  }, [validateClaim]);

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
          {claims.length === 0 ? (
            <div className="text-center text-gray-500 p-8">
              <p className="mb-2">No claims to review at this time.</p>
              <Button 
                variant="outline" 
                onClick={() => {
                  if (sessionId) {
                    network.fetchClaims(sessionId);
                    toast({
                      title: "Refreshing",
                      description: "Checking for new claims...",
                      duration: 2000
                    });
                  }
                }}
                className="inline-flex items-center gap-2"
                size="sm"
              >
                <RefreshCw className="h-3 w-3" /> 
                Refresh
              </Button>
            </div>
          ) : (
            claims.map((claim, index) => (
              <div key={index} className="border rounded-md p-4">
                <div className="font-bold">Claim Details</div>
                <div>Player: {claim.player_name}</div>
                <div>Session: {claim.session_id?.substring(0, 8)}...</div>
                <div>Game: {claim.game_number || gameNumber}</div>
                <div>Pattern: {claim.win_pattern || currentWinPattern}</div>
                <div>Claimed at: {new Date(claim.claimed_at).toLocaleTimeString()}</div>
                
                {/* Display the ticket information */}
                {claim.ticket_numbers && claim.ticket_layout_mask && (
                  <div className="mt-4 border-t pt-3">
                    <h3 className="font-medium text-sm mb-2">Claimed Ticket:</h3>
                    <CallerTicketDisplay
                      ticket={{
                        numbers: claim.ticket_numbers,
                        layoutMask: claim.ticket_layout_mask,
                        serial: claim.ticket_serial || "Unknown",
                        perm: claim.ticket_perm,
                        position: claim.ticket_position
                      }}
                      calledNumbers={currentCalledNumbers || claim.called_numbers || []}
                      lastCalledNumber={currentNumber}
                      gameType={gameType}
                      winPattern={currentWinPattern || claim.win_pattern}
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

function RefreshCw(props: any) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
      <path d="M21 3v5h-5"></path>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
      <path d="M8 16H3v5"></path>
    </svg>
  );
}
