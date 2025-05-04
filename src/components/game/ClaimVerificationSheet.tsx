
import React, { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle, XCircle } from 'lucide-react';
import { logWithTimestamp } from '@/utils/logUtils';
import { supabase } from '@/integrations/supabase/client';
import CallerTicketDisplay from './CallerTicketDisplay';

// Add import for the useCallerClaimManagement hook
import { useCallerClaimManagement } from '@/hooks/useCallerClaimManagement';
import { connectionManager } from '@/utils/connectionManager';

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
  // Use the claim management hook
  const { 
    claims, 
    validateClaim, 
    isProcessingClaim 
  } = useCallerClaimManagement(sessionId || null);
  
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  
  // Force fetch claims when sheet opens
  useEffect(() => {
    if (isOpen && sessionId) {
      // Fetch claims through connectionManager to use our single channel approach
      const fetchLatestClaims = async () => {
        logWithTimestamp(`Fetching latest claims for session ${sessionId}`);
        try {
          const claims = await connectionManager.fetchClaims(sessionId);
          logWithTimestamp(`Found ${claims?.length || 0} pending claims`);
        } catch (e) {
          console.error('Exception fetching claims:', e);
        }
      };
      
      fetchLatestClaims();
    }
  }, [isOpen, sessionId]);
  
  // Log claims when they change
  useEffect(() => {
    logWithTimestamp(`ClaimVerificationSheet has ${claims.length} claims`);
  }, [claims]);

  // Enhance the verify/reject handlers to use the new hook
  const handleVerify = useCallback((claim: any) => {
    if (!claim) return;
    
    logWithTimestamp(`Verifying claim: ${claim.id}`);
    
    // Use connectionManager directly for claim validation to ensure single channel approach
    connectionManager.validateClaim(claim, true)
      .then(success => {
        if (success) {
          toast({
            title: "Claim Verified",
            description: "The bingo claim has been verified successfully.",
            variant: "default"
          });
        } else {
          toast({
            title: "Verification Error",
            description: "There was an error verifying the claim.",
            variant: "destructive"
          });
        }
      })
      .catch(err => {
        console.error("Error validating claim:", err);
        toast({
          title: "Verification Error",
          description: "There was an error verifying the claim.",
          variant: "destructive"
        });
      });
    
  }, [toast]);
  
  const handleReject = useCallback((claim: any) => {
    if (!claim) return;
    
    logWithTimestamp(`Rejecting claim: ${claim.id}`);
    
    // Use connectionManager directly for claim validation to ensure single channel approach
    connectionManager.validateClaim(claim, false)
      .then(success => {
        if (success) {
          toast({
            title: "Claim Rejected",
            description: "The bingo claim has been rejected.",
            variant: "default"
          });
        } else {
          toast({
            title: "Rejection Error",
            description: "There was an error rejecting the claim.",
            variant: "destructive"
          });
        }
      })
      .catch(err => {
        console.error("Error rejecting claim:", err);
        toast({
          title: "Rejection Error",
          description: "There was an error rejecting the claim.",
          variant: "destructive"
        });
      });
    
  }, [toast]);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Claim Verification</SheetTitle>
          <SheetDescription>
            Review and validate bingo claims.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          {claims.length === 0 ? (
            <div className="text-center text-gray-500">
              No claims to review at this time.
            </div>
          ) : (
            claims.map((claim, index) => (
              <div key={index} className="border rounded-md p-4">
                <div className="font-bold">Claim Details</div>
                <div>Player: {claim.playerName || claim.player_name}</div>
                <div>Session: {claim.sessionId || claim.session_id}</div>
                <div>Game: {gameNumber || claim.game_number}</div>
                <div>Claimed at: {claim.timestamp || claim.claimed_at}</div>
                
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
                      winPattern={currentWinPattern || undefined}
                    />
                  </div>
                )}
                
                <div className="flex justify-end gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => handleVerify(claim)}
                    disabled={isProcessingClaim}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Verify
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => handleReject(claim)}
                    disabled={isProcessingClaim}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
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
