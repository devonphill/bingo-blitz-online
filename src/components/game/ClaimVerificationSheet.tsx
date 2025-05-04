
import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ClaimVerificationModal from './ClaimVerificationModal';
import { logWithTimestamp } from '@/utils/logUtils';
import { useClaimManagement } from '@/hooks/useClaimManagement';

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
  gameNumber = 1,
  currentCalledNumbers = [],
  gameType = 'mainstage',
  playerName = '',
  currentNumber = null,
  currentWinPattern = null
}: ClaimVerificationSheetProps) {
  const [claims, setClaims] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const { toast } = useToast();
  const { validateClaim, rejectClaim } = useClaimManagement(sessionId, gameNumber);
  
  // Log key props for debugging
  console.log("ClaimVerificationSheet rendered with isOpen:", isOpen, "sessionId:", sessionId);

  const fetchClaims = React.useCallback(async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    try {
      logWithTimestamp(`Fetching claims for session ${sessionId}`);
      
      // Query universal_game_logs table for unvalidated claims
      const { data, error } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', sessionId)
        .is('validated_at', null)
        .not('claimed_at', 'is', null);  // Make sure we only get claims
      
      if (error) {
        console.error('Error fetching claims:', error);
        return;
      }
      
      logWithTimestamp(`Found ${data?.length || 0} pending claims`);
      if (data && data.length > 0) {
        setClaims(data);
      }
    } catch (err) {
      console.error('Exception in fetchClaims:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);
  
  // Fetch claims when the sheet is opened or sessionId changes
  useEffect(() => {
    if (isOpen && sessionId) {
      fetchClaims();
    }
  }, [isOpen, sessionId, fetchClaims]);

  // Listen for new claims
  useEffect(() => {
    if (!sessionId) return;
    
    const channel = supabase
      .channel('caller-claims-listener')
      .on(
        'broadcast',
        { event: 'bingo-claim' },
        async (payload) => {
          console.log("Received bingo claim broadcast:", payload);
          if (payload.payload && payload.payload.sessionId === sessionId) {
            toast({
              title: "New Bingo Claim!",
              description: `${payload.payload.playerName} has claimed bingo! Check the claims panel to verify.`,
              variant: "default",
            });
            
            // Automatically fetch updated claims
            fetchClaims();
          }
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchClaims, toast]);

  const handleOpenVerifyModal = (claim: any) => {
    console.log("Opening verification modal for claim:", claim);
    setSelectedClaim(claim);
    setIsVerifyModalOpen(true);
  };

  const handleCloseVerifyModal = () => {
    setIsVerifyModalOpen(false);
    setSelectedClaim(null);
  };

  const handleValidClaim = async () => {
    if (!selectedClaim) return;
    
    try {
      // Call the validateClaim function
      const success = await validateClaim(
        selectedClaim.player_id,
        selectedClaim.player_name,
        selectedClaim.win_pattern,
        selectedClaim.called_numbers,
        selectedClaim.last_called_number,
        {
          serial: selectedClaim.ticket_serial,
          perm: selectedClaim.ticket_perm,
          position: selectedClaim.ticket_position,
          layoutMask: selectedClaim.ticket_layout_mask,
          numbers: selectedClaim.ticket_numbers
        }
      );
      
      if (success) {
        toast({
          title: "Claim Validated",
          description: "The claim has been validated successfully",
        });
        
        // Refresh claims
        await fetchClaims();
        
        // Close the verify modal
        handleCloseVerifyModal();
      }
    } catch (err) {
      console.error("Error validating claim:", err);
    }
  };

  const handleRejectClaim = async () => {
    if (!selectedClaim) return;
    
    try {
      // Call the rejectClaim function
      const success = await rejectClaim(
        selectedClaim.player_id,
        selectedClaim.player_name,
        selectedClaim.win_pattern,
        selectedClaim.called_numbers,
        selectedClaim.last_called_number,
        {
          serial: selectedClaim.ticket_serial,
          perm: selectedClaim.ticket_perm,
          position: selectedClaim.ticket_position,
          layoutMask: selectedClaim.ticket_layout_mask,
          numbers: selectedClaim.ticket_numbers
        }
      );
      
      if (success) {
        toast({
          title: "Claim Rejected",
          description: "The claim has been rejected",
        });
        
        // Refresh claims
        await fetchClaims();
        
        // Close the verify modal
        handleCloseVerifyModal();
      }
    } catch (err) {
      console.error("Error rejecting claim:", err);
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Pending Claims</SheetTitle>
          </SheetHeader>
          
          <div className="py-4">
            <Button onClick={() => fetchClaims()} variant="outline" className="mb-4 w-full">
              Refresh Claims
            </Button>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
              </div>
            ) : claims.length > 0 ? (
              <div className="space-y-4">
                {claims.map((claim) => (
                  <div
                    key={claim.id}
                    className="border rounded-md p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleOpenVerifyModal(claim)}
                  >
                    <div className="font-medium">{claim.player_name || claim.player_id}</div>
                    <div className="text-sm text-gray-500">
                      Pattern: {claim.win_pattern || 'Unknown'}
                    </div>
                    <div className="text-sm text-gray-500">
                      Ticket: {claim.ticket_serial}
                    </div>
                    <div className="text-sm text-gray-500">
                      Claimed: {new Date(claim.claimed_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                No pending claims found
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {selectedClaim && (
        <ClaimVerificationModal
          isOpen={isVerifyModalOpen}
          onClose={handleCloseVerifyModal}
          playerName={selectedClaim.player_name || selectedClaim.player_id}
          tickets={[
            {
              serial: selectedClaim.ticket_serial,
              numbers: selectedClaim.ticket_numbers,
              layoutMask: selectedClaim.ticket_layout_mask
            }
          ]}
          calledNumbers={currentCalledNumbers || selectedClaim.called_numbers}
          currentNumber={currentNumber || selectedClaim.last_called_number}
          onValidClaim={handleValidClaim}
          onFalseClaim={handleRejectClaim}
          currentWinPattern={currentWinPattern || selectedClaim.win_pattern}
        />
      )}
    </>
  );
}
