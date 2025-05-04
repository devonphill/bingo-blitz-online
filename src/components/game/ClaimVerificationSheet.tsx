import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useClaimManagement } from '@/hooks/useClaimManagement';
import ClaimVerificationModal from '@/components/game/ClaimVerificationModal';
import { logWithTimestamp } from '@/utils/logUtils';

interface ClaimVerificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  gameNumber?: number;
  currentCalledNumbers: number[];
  gameType: string;
  playerName?: string;
  currentNumber: number | null;
  currentWinPattern: string | null;
}

export default function ClaimVerificationSheet({
  isOpen,
  onClose,
  sessionId,
  gameNumber,
  currentCalledNumbers,
  gameType,
  playerName,
  currentNumber,
  currentWinPattern,
}: ClaimVerificationSheetProps) {
  const [claims, setClaims] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeClaimPlayerName, setActiveClaimPlayerName] = useState<string | null>(null);
  const [activeClaimPlayerCode, setActiveClaimPlayerCode] = useState<string | null>(null);
  const [activeClaimTickets, setActiveClaimTickets] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  
  const { validateClaim, rejectClaim, isProcessingClaim } = useClaimManagement(
    sessionId, 
    gameNumber
  );

  // Fetch claims when the sheet is opened
  useEffect(() => {
    if (isOpen && sessionId) {
      fetchClaims();
    }
  }, [isOpen, sessionId]);
  
  // When playerName prop changes, update state
  useEffect(() => {
    if (playerName) {
      setActiveClaimPlayerName(playerName);
      setActiveClaimPlayerCode(playerName); // Assuming playerName might be a code
    }
  }, [playerName]);

  // Fetch pending claims from universal_game_logs
  const fetchClaims = async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    try {
      logWithTimestamp(`Fetching claims for session ${sessionId}`);
      
      // Get unvalidated claims for this session
      const { data: realtimeClaims, error: realtimeError } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', sessionId)
        .is('validated_at', null)
        .not('claimed_at', 'is', null)
        .order('claimed_at', { ascending: true });

      if (realtimeError) {
        console.error("Error fetching realtime claims:", realtimeError);
      }
      
      // If there are claims, store them
      if (realtimeClaims && realtimeClaims.length > 0) {
        console.log("Found realtime claims:", realtimeClaims);
        setClaims(realtimeClaims);
        
        // If there's an active claim, get the player's tickets
        if (realtimeClaims[0]) {
          const playerCode = realtimeClaims[0].player_id;
          const playerName = realtimeClaims[0].player_name || playerCode;
          
          if (playerCode) {
            setActiveClaimPlayerName(playerName);
            setActiveClaimPlayerCode(playerCode);
            
            // If the claim already has ticket data, use it
            if (realtimeClaims[0].ticket_serial && realtimeClaims[0].ticket_numbers) {
              setActiveClaimTickets([{
                serial: realtimeClaims[0].ticket_serial,
                perm: realtimeClaims[0].ticket_perm,
                position: realtimeClaims[0].ticket_position,
                layout_mask: realtimeClaims[0].ticket_layout_mask,
                numbers: realtimeClaims[0].ticket_numbers
              }]);
              setModalOpen(true);
            } else {
              // Otherwise fetch the player's tickets
              fetchPlayerTickets(playerCode);
            }
          }
          
          setModalOpen(true);
        }
      } else {
        // If no claims were found through the database, try an alternative approach
        console.log("No pending claims found in database");
        
        // Check if we have a player name passed in props
        if (playerName) {
          setActiveClaimPlayerName(playerName);
          setActiveClaimPlayerCode(playerName);
          fetchPlayerTickets(playerName);
          setModalOpen(true);
        }
      }
    } catch (error) {
      console.error("Error in fetchClaims:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch a player's tickets
  const fetchPlayerTickets = async (playerCode: string) => {
    if (!sessionId) return;
    
    try {
      logWithTimestamp(`Fetching tickets for player ${playerCode}`);
      
      // Different approach for UUIDs vs. player codes
      let queryBy = 'player_id';
      
      // Check if it looks like a player code rather than UUID
      if (playerCode.length < 30 && !playerCode.includes('-')) {
        console.log("Using player_code query approach");
        
        // First find the player's UUID from the player code
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('id')
          .eq('player_code', playerCode)
          .single();
          
        if (playerError) {
          console.error("Error finding player by code:", playerError);
        } else if (playerData) {
          console.log("Found player by code:", playerData);
          playerCode = playerData.id;
        } else {
          // Continue with original code as fallback
          console.log("No player found by code, using original code as ID");
        }
      }
      
      // Get tickets assigned to this player for this session
      const { data: tickets, error: ticketsError } = await supabase
        .from('assigned_tickets')
        .select('*')
        .eq('session_id', sessionId)
        .eq('player_id', playerCode);
      
      if (ticketsError) {
        console.error("Error fetching player tickets:", ticketsError);
        return;
      }
      
      if (tickets && tickets.length > 0) {
        console.log(`Found ${tickets.length} tickets for player:`, tickets);
        setActiveClaimTickets(tickets);
        setModalOpen(true);
      } else {
        console.log("No tickets found for player");
      }
    } catch (error) {
      console.error("Error fetching player tickets:", error);
    }
  };

  // Validate a claim
  const handleValidClaim = async () => {
    if (!activeClaimPlayerCode || !sessionId || !gameNumber || activeClaimTickets.length === 0) {
      console.error("Missing data for claim validation");
      return;
    }
    
    // Use the first ticket for validation
    const ticketData = {
      serial: activeClaimTickets[0].serial,
      perm: activeClaimTickets[0].perm,
      position: activeClaimTickets[0].position,
      layoutMask: activeClaimTickets[0].layoutMask || activeClaimTickets[0].layout_mask,
      numbers: activeClaimTickets[0].numbers
    };
    
    // Validate the claim
    const success = await validateClaim(
      activeClaimPlayerCode,
      activeClaimPlayerName || activeClaimPlayerCode,
      currentWinPattern || 'fullHouse',
      currentCalledNumbers,
      currentNumber,
      ticketData
    );
    
    if (success) {
      // Clear claims and close modal
      setModalOpen(false);
      setClaims([]);
      onClose();
    }
  };

  // Reject a claim
  const handleFalseClaim = async () => {
    if (!activeClaimPlayerCode || !sessionId || !gameNumber || activeClaimTickets.length === 0) {
      console.error("Missing data for claim rejection");
      return;
    }
    
    // Use the first ticket for rejection
    const ticketData = {
      serial: activeClaimTickets[0].serial,
      perm: activeClaimTickets[0].perm,
      position: activeClaimTickets[0].position,
      layoutMask: activeClaimTickets[0].layoutMask || activeClaimTickets[0].layout_mask,
      numbers: activeClaimTickets[0].numbers
    };
    
    // Reject the claim
    const success = await rejectClaim(
      activeClaimPlayerCode,
      activeClaimPlayerName || activeClaimPlayerCode,
      currentWinPattern || 'fullHouse',
      currentCalledNumbers,
      currentNumber,
      ticketData
    );
    
    if (success) {
      // Clear claims and close modal
      setModalOpen(false);
      setClaims([]);
      onClose();
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="text-xl">Verify Bingo Claims</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
              </div>
            ) : claims.length === 0 && !activeClaimPlayerName ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No pending claims to verify.</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-lg mb-4">
                  Bingo claimed by: {activeClaimPlayerName || "Unknown Player"}
                </p>
                
                {activeClaimTickets.length > 0 ? (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      Player has {activeClaimTickets.length} tickets. Showing the most promising:
                    </p>
                  </div>
                ) : (
                  <p className="text-amber-600">No tickets found for this player.</p>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
      
      {modalOpen && activeClaimPlayerName && (
        <ClaimVerificationModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          playerName={activeClaimPlayerName}
          tickets={activeClaimTickets}
          calledNumbers={currentCalledNumbers}
          currentNumber={currentNumber}
          onValidClaim={handleValidClaim}
          onFalseClaim={handleFalseClaim}
          currentWinPattern={currentWinPattern}
        />
      )}
    </>
  );
}
