
import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ClaimVerificationModal from './ClaimVerificationModal';
import { logWithTimestamp } from '@/utils/logUtils';
import { useClaimManagement } from '@/hooks/useClaimManagement';
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
  gameNumber = 1,
  currentCalledNumbers = [],
  gameType = 'mainstage',
  playerName = '',
  currentNumber = null,
  currentWinPattern = null
}: ClaimVerificationSheetProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const { toast } = useToast();
  
  // Get claim management hooks - use both for compatibility
  const { validateClaim, rejectClaim } = useClaimManagement(sessionId, gameNumber);
  const { 
    pendingClaims: broadcastClaims, 
    validateClaim: validateBroadcastClaim, 
    rejectClaim: rejectBroadcastClaim 
  } = useCallerClaimManagement(sessionId);
  
  // Log key props for debugging
  console.log("ClaimVerificationSheet rendered with isOpen:", isOpen, "sessionId:", sessionId);
  console.log("Current pending claims:", broadcastClaims?.length || 0);

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
      // Call the validateClaim function - this writes to the database
      const ticketData = selectedClaim.ticketData || {
        serial: selectedClaim.ticket_serial,
        perm: selectedClaim.ticket_perm,
        position: selectedClaim.ticket_position,
        layoutMask: selectedClaim.ticket_layout_mask,
        numbers: selectedClaim.ticket_numbers
      };
      
      // Use broadcast validate if it's a broadcast claim
      if (selectedClaim.playerId) {
        const success = await validateBroadcastClaim(
          selectedClaim.playerId,
          selectedClaim.playerName,
          currentWinPattern || selectedClaim.win_pattern || 'fullHouse',
          currentCalledNumbers || selectedClaim.called_numbers || [],
          currentNumber || selectedClaim.last_called_number,
          ticketData
        );
        
        if (success) {
          toast({
            title: "Claim Validated",
            description: "The claim has been validated successfully",
          });
          
          // Close the verify modal
          handleCloseVerifyModal();
        }
      } 
      // Use traditional validate for database claims
      else {
        const success = await validateClaim(
          selectedClaim.player_id,
          selectedClaim.player_name,
          selectedClaim.win_pattern,
          selectedClaim.called_numbers,
          selectedClaim.last_called_number,
          ticketData
        );
        
        if (success) {
          toast({
            title: "Claim Validated",
            description: "The claim has been validated successfully",
          });
          
          // Close the verify modal
          handleCloseVerifyModal();
        }
      }
    } catch (err) {
      console.error("Error validating claim:", err);
    }
  };

  const handleRejectClaim = async () => {
    if (!selectedClaim) return;
    
    try {
      // Call the rejectClaim function - this writes to the database
      const ticketData = selectedClaim.ticketData || {
        serial: selectedClaim.ticket_serial,
        perm: selectedClaim.ticket_perm,
        position: selectedClaim.ticket_position,
        layoutMask: selectedClaim.ticket_layout_mask,
        numbers: selectedClaim.ticket_numbers
      };
      
      // Use broadcast reject if it's a broadcast claim
      if (selectedClaim.playerId) {
        const success = await rejectBroadcastClaim(
          selectedClaim.playerId,
          selectedClaim.playerName,
          currentWinPattern || selectedClaim.win_pattern || 'fullHouse',
          currentCalledNumbers || selectedClaim.called_numbers || [],
          currentNumber || selectedClaim.last_called_number,
          ticketData
        );
        
        if (success) {
          toast({
            title: "Claim Rejected",
            description: "The claim has been rejected",
          });
          
          // Close the verify modal
          handleCloseVerifyModal();
        }
      }
      // Use traditional reject for database claims
      else {
        const success = await rejectClaim(
          selectedClaim.player_id,
          selectedClaim.player_name,
          selectedClaim.win_pattern,
          selectedClaim.called_numbers,
          selectedClaim.last_called_number,
          ticketData
        );
        
        if (success) {
          toast({
            title: "Claim Rejected",
            description: "The claim has been rejected",
          });
          
          // Close the verify modal
          handleCloseVerifyModal();
        }
      }
    } catch (err) {
      console.error("Error rejecting claim:", err);
    }
  };

  // Get claims from different sources - prefer broadcast claims (in-memory) over database claims
  const effectiveClaims = broadcastClaims.length > 0 ? broadcastClaims : [];

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Pending Claims</SheetTitle>
          </SheetHeader>
          
          <div className="py-4">
            <Button onClick={() => setIsLoading(false)} variant="outline" className="mb-4 w-full">
              Refresh Claims
            </Button>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
              </div>
            ) : effectiveClaims.length > 0 ? (
              <div className="space-y-4">
                {effectiveClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="border rounded-md p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleOpenVerifyModal(claim)}
                  >
                    <div className="font-medium">{claim.playerName || claim.player_name || claim.playerId || claim.player_id}</div>
                    <div className="text-sm text-gray-500">
                      Pattern: {claim.win_pattern || currentWinPattern || 'Unknown'}
                    </div>
                    <div className="text-sm text-gray-500">
                      Ticket: {claim.ticketData?.serial || claim.ticket_serial}
                    </div>
                    <div className="text-sm text-gray-500">
                      Claimed: {new Date(claim.timestamp || claim.claimed_at).toLocaleTimeString()}
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
          playerName={selectedClaim.playerName || selectedClaim.player_name || selectedClaim.playerId || selectedClaim.player_id}
          tickets={[
            {
              serial: selectedClaim.ticketData?.serial || selectedClaim.ticket_serial,
              numbers: selectedClaim.ticketData?.numbers || selectedClaim.ticket_numbers,
              layoutMask: selectedClaim.ticketData?.layoutMask || selectedClaim.ticket_layout_mask
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
