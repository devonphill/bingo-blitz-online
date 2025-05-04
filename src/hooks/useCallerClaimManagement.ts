
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';

export function useCallerClaimManagement(sessionId: string | undefined) {
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const { toast } = useToast();

  // Helper function to check if a string is likely to be a player code rather than UUID
  const isPlayerCode = (id: string) => {
    return id.length < 30 && /[A-Za-z]/.test(id);
  };

  // Validate a bingo claim - This is where we write to the database
  const validateClaim = useCallback(async (
    playerId: string,
    playerName: string,
    winPattern: string,
    calledNumbers: number[],
    lastCalledNumber: number | null,
    ticketData: any
  ) => {
    if (!sessionId) {
      toast({
        title: "Error",
        description: "No active session found",
        variant: "destructive"
      });
      return false;
    }

    setIsProcessingClaim(true);
    try {
      logWithTimestamp(`Validating claim for player ${playerName || playerId}, pattern: ${winPattern}`);
      
      // Check if we need to resolve a player code to UUID
      let actualPlayerId = playerId;
      
      if (isPlayerCode(playerId)) {
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('id, nickname')
          .eq('player_code', playerId)
          .single();
          
        if (playerError) {
          console.error("Error finding player by code:", playerError);
        } else if (playerData) {
          console.log("Found player by code:", playerData);
          actualPlayerId = playerData.id;
          // Update player name if available
          if (playerData.nickname) {
            playerName = playerData.nickname;
          }
        }
      }
      
      // Insert a new validated entry - validated_at will be set by the caller
      const { error: insertError } = await supabase
        .from('universal_game_logs')
        .insert({
          session_id: sessionId,
          player_id: actualPlayerId,
          player_name: playerName,
          game_number: 1, // Use game number from session if available
          game_type: 'mainstage',
          win_pattern: winPattern,
          ticket_serial: ticketData.serial,
          ticket_perm: ticketData.perm,
          ticket_position: ticketData.position,
          ticket_layout_mask: ticketData.layoutMask || ticketData.layout_mask,
          ticket_numbers: ticketData.numbers,
          called_numbers: calledNumbers,
          last_called_number: lastCalledNumber,
          total_calls: calledNumbers.length,
          claimed_at: new Date().toISOString(),
          validated_at: new Date().toISOString(), // Set by the caller
          prize_shared: true
        });

      if (insertError) {
        console.error("Error inserting claim:", insertError);
        toast({
          title: "Error",
          description: "Failed to validate claim",
          variant: "destructive"
        });
        return false;
      }

      // Broadcast the result to the player - try with both player ID formats
      try {
        // If we have both UUID and player code versions, send to both
        const broadcastChannel = supabase.channel('game-updates');
        
        // Send to UUID
        await broadcastChannel.send({
          type: 'broadcast',
          event: 'claim-result',
          payload: {
            playerId: actualPlayerId,
            result: 'valid'
          }
        });
        
        // If we originally had a player code, also send to that
        if (actualPlayerId !== playerId) {
          await broadcastChannel.send({
            type: 'broadcast',
            event: 'claim-result',
            payload: {
              playerId: playerId, // Original player code
              result: 'valid'
            }
          });
        }
      } catch (err) {
        console.error("Error broadcasting claim result:", err);
      }

      toast({
        title: "Claim Validated",
        description: "The claim has been validated successfully"
      });
      
      // Remove the claim from pending claims
      setPendingClaims(prev => prev.filter(claim => 
        claim.playerId !== playerId && claim.playerId !== actualPlayerId
      ));

      return true;
    } catch (err) {
      console.error("Error validating claim:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred during validation",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsProcessingClaim(false);
    }
  }, [sessionId, toast]);

  // Reject a bingo claim - This is where we write to the database for rejected claims
  const rejectClaim = useCallback(async (
    playerId: string,
    playerName: string,
    winPattern: string,
    calledNumbers: number[],
    lastCalledNumber: number | null,
    ticketData: any
  ) => {
    if (!sessionId) {
      toast({
        title: "Error",
        description: "No active session found",
        variant: "destructive"
      });
      return false;
    }

    setIsProcessingClaim(true);
    try {
      logWithTimestamp(`Rejecting claim for player ${playerName || playerId}, pattern: ${winPattern}`);

      // Check if we need to resolve a player code to UUID
      let actualPlayerId = playerId;
      
      if (isPlayerCode(playerId)) {
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('id, nickname')
          .eq('player_code', playerId)
          .single();
          
        if (playerError) {
          console.error("Error finding player by code:", playerError);
        } else if (playerData) {
          console.log("Found player by code:", playerData);
          actualPlayerId = playerData.id;
          // Update player name if available
          if (playerData.nickname) {
            playerName = playerData.nickname;
          }
        }
      }

      // Create a rejected entry in the database
      const { error: insertError } = await supabase
        .from('universal_game_logs')
        .insert({
          session_id: sessionId,
          player_id: actualPlayerId, 
          player_name: playerName,
          game_number: 1, // Use game number from session if available
          game_type: 'mainstage',
          win_pattern: winPattern,
          ticket_serial: ticketData.serial,
          ticket_perm: ticketData.perm,
          ticket_position: ticketData.position,
          ticket_layout_mask: ticketData.layoutMask || ticketData.layout_mask,
          ticket_numbers: ticketData.numbers,
          called_numbers: calledNumbers,
          last_called_number: lastCalledNumber,
          total_calls: calledNumbers.length,
          claimed_at: new Date().toISOString(),
          validated_at: new Date().toISOString(), // Set by the caller
          prize_shared: false // Mark as rejected
        });

      if (insertError) {
        console.error("Error inserting claim:", insertError);
        toast({
          title: "Error",
          description: "Failed to reject claim",
          variant: "destructive"
        });
        return false;
      }

      // Broadcast the result to the player - try with both player ID formats
      try {
        // If we have both UUID and player code versions, send to both
        const broadcastChannel = supabase.channel('game-updates');
        
        // Send to UUID
        await broadcastChannel.send({
          type: 'broadcast',
          event: 'claim-result',
          payload: {
            playerId: actualPlayerId,
            result: 'rejected'
          }
        });
        
        // If we originally had a player code, also send to that
        if (actualPlayerId !== playerId) {
          await broadcastChannel.send({
            type: 'broadcast',
            event: 'claim-result',
            payload: {
              playerId: playerId, // Original player code
              result: 'rejected'
            }
          });
        }
      } catch (err) {
        console.error("Error broadcasting claim result:", err);
      }

      toast({
        title: "Claim Rejected",
        description: "The claim has been rejected"
      });
      
      // Remove the claim from pending claims
      setPendingClaims(prev => prev.filter(claim => 
        claim.playerId !== playerId && claim.playerId !== actualPlayerId
      ));

      return true;
    } catch (err) {
      console.error("Error rejecting claim:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred during rejection",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsProcessingClaim(false);
    }
  }, [sessionId, toast]);

  // Listen for new claims via broadcast instead of querying the database
  useEffect(() => {
    if (!sessionId) return;
    
    const channel = supabase
      .channel('caller-claims-listener')
      .on(
        'broadcast',
        { event: 'bingo-claim' },
        (payload) => {
          logWithTimestamp("Received bingo claim broadcast:", payload);
          
          if (payload.payload?.sessionId === sessionId) {
            const claimData = payload.payload;
            
            // Check if we already have this claim
            const claimExists = pendingClaims.some(
              existing => existing.playerId === claimData.playerId && 
                         existing.ticketData?.serial === claimData.ticketData?.serial
            );
            
            if (!claimExists) {
              // Add the new claim to our state
              setPendingClaims(prev => [...prev, {
                id: `claim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                playerId: claimData.playerId,
                playerName: claimData.playerName,
                ticketData: claimData.ticketData,
                timestamp: claimData.timestamp,
                sessionId: sessionId
              }]);
              
              toast({
                title: "New Bingo Claim!",
                description: `${claimData.playerName || claimData.playerId} has claimed bingo! Check the claims panel to verify.`,
                variant: "default",
              });
            }
          }
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, pendingClaims, toast]);

  return {
    pendingClaims,
    isProcessingClaim,
    validateClaim,
    rejectClaim
  };
}
