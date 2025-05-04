
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
  
  const { toast } = useToast()
  const [notes, setNotes] = useState("")
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  
  // Force fetch claims when sheet opens
  useEffect(() => {
    if (isOpen && sessionId) {
      // Direct database query to ensure we have the latest data
      const fetchLatestClaims = async () => {
        logWithTimestamp(`Fetching latest claims for session ${sessionId}`);
        try {
          const { data, error } = await supabase
            .from('universal_game_logs')
            .select('*')
            .eq('session_id', sessionId)
            .is('validated_at', null)
            .not('claimed_at', 'is', null);
            
          if (error) {
            console.error('Error fetching latest claims:', error);
          } else {
            logWithTimestamp(`Found ${data?.length || 0} pending claims`);
            console.log('Latest claims data:', data);
          }
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
    console.log('Claims:', claims);
  }, [claims]);

  // Enhance the verify/reject handlers to use the new hook
  const handleVerify = useCallback((claim: any) => {
    if (!claim) return;
    
    logWithTimestamp(`Verifying claim: ${JSON.stringify(claim)}`);
    validateClaim(claim, true);
    
  }, [validateClaim]);
  
  const handleReject = useCallback((claim: any) => {
    if (!claim) return;
    
    logWithTimestamp(`Rejecting claim: ${JSON.stringify(claim)}`);
    validateClaim(claim, false);
    
  }, [validateClaim]);

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
