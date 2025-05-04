
import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useClaimManagement } from '@/hooks/useClaimManagement';
import ClaimVerificationModal from '@/components/game/ClaimVerificationModal';

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

  const fetchClaims = async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    try {
      // First check for real-time claims
      const { data: realtimeClaims, error: realtimeError } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', sessionId)
        .eq('game_number', gameNumber)
        .is('validated_at', null)
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
          const playerCode = realtimeClaims[0].player_id || realtimeClaims[0].player_name;
          if (playerCode) {
            setActiveClaimPlayerName(realtimeClaims[0].player_name || playerCode);
            setActiveClaimPlayerCode(playerCode);
            fetchPlayerTickets(playerCode);
          }
        }
        
        setModalOpen(true);
      } else {
        // If no claims were found through the database, try an alternative approach
        // You could add another fetch method here if needed
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

  const fetchPlayerTickets = async (playerCode: string) => {
    if (!sessionId) return;
    
    try {
      console.log("Fetching tickets for player code:", playerCode);
      
      // First try player_id field
      const { data: ticketsById, error: errorById } = await supabase
        .from('assigned_tickets')
        .select('*')
        .eq('session_id', sessionId);
        // We intentionally don't filter by player_id here as it might be a playerCode instead

      if (errorById) {
        console.error("Error fetching player tickets by ID:", errorById);
        return;
      }
      
      // Find tickets that match either the player_id or potentially a player code
      // This handles both UUID format player IDs and string player codes
      let matchingTickets: any[] = [];
      
      if (ticketsById) {
        // Filter by playerCode after fetching - this lets us apply our own matching logic
        matchingTickets = ticketsById.filter(ticket => 
          ticket.player_id === playerCode || 
          ticket.player_id?.includes(playerCode)
        );
      }
      
      // If we found tickets, use them
      if (matchingTickets.length > 0) {
        console.log(`Found ${matchingTickets.length} tickets for player:`, matchingTickets);
        setActiveClaimTickets(matchingTickets);
        return;
      }
      
      // If no tickets found, try fallback approach
      console.log("No tickets found using player_id, trying alternative approach");
    } catch (error) {
      console.error("Error fetching player tickets:", error);
    }
  };

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
      layoutMask: activeClaimTickets[0].layout_mask,
      numbers: activeClaimTickets[0].numbers
    };
    
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
      layoutMask: activeClaimTickets[0].layout_mask,
      numbers: activeClaimTickets[0].numbers
    };
    
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
