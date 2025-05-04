import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';

export function useClaimManagement(sessionId?: string, gameNumber?: number) {
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const { toast } = useToast();

  // Validate a bingo claim
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
      
      // First update the claim in the universal_game_logs table if it exists
      const { data: existingClaims, error: fetchError } = await supabase
        .from('universal_game_logs')
        .select('id')
        .eq('session_id', sessionId)
        .eq('player_id', playerId)
        .is('validated_at', null);

      if (fetchError) {
        console.error("Error fetching existing claims:", fetchError);
      }

      // If we found an existing claim, update it
      if (existingClaims && existingClaims.length > 0) {
        const { error: updateError } = await supabase
          .from('universal_game_logs')
          .update({
            validated_at: new Date().toISOString(),
            prize_shared: true
          })
          .eq('id', existingClaims[0].id);

        if (updateError) {
          console.error("Error updating claim:", updateError);
          toast({
            title: "Error",
            description: "Failed to validate claim",
            variant: "destructive"
          });
          return false;
        }
      } else {
        // Otherwise create a new validated entry
        const { error: insertError } = await supabase
          .from('universal_game_logs')
          .insert({
            session_id: sessionId,
            player_id: playerId,
            player_name: playerName,
            game_number: gameNumber || 1,
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
            validated_at: new Date().toISOString(),
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
      }

      // Broadcast the result to the player
      await supabase
        .channel('game-updates')
        .send({
          type: 'broadcast',
          event: 'claim-result',
          payload: {
            playerId: playerId,
            result: 'valid'
          }
        });

      toast({
        title: "Claim Validated",
        description: "The claim has been validated successfully"
      });

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
  }, [sessionId, gameNumber, toast]);

  // Reject a bingo claim
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

      // First update the claim in the universal_game_logs table if it exists
      const { data: existingClaims, error: fetchError } = await supabase
        .from('universal_game_logs')
        .select('id')
        .eq('session_id', sessionId)
        .eq('player_id', playerId)
        .is('validated_at', null);

      if (fetchError) {
        console.error("Error fetching existing claims:", fetchError);
      }

      // If we found an existing claim, update it
      if (existingClaims && existingClaims.length > 0) {
        const { error: updateError } = await supabase
          .from('universal_game_logs')
          .update({
            validated_at: new Date().toISOString(), 
            prize_shared: false // Mark as rejected
          })
          .eq('id', existingClaims[0].id);

        if (updateError) {
          console.error("Error updating claim:", updateError);
          toast({
            title: "Error",
            description: "Failed to reject claim",
            variant: "destructive"
          });
          return false;
        }
      } else {
        // Otherwise create a new rejected entry
        const { error: insertError } = await supabase
          .from('universal_game_logs')
          .insert({
            session_id: sessionId,
            player_id: playerId, 
            player_name: playerName,
            game_number: gameNumber || 1,
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
            validated_at: new Date().toISOString(),
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
      }

      // Broadcast the result to the player
      await supabase
        .channel('game-updates')
        .send({
          type: 'broadcast',
          event: 'claim-result',
          payload: {
            playerId: playerId,
            result: 'rejected'
          }
        });

      toast({
        title: "Claim Rejected",
        description: "The claim has been rejected"
      });

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
  }, [sessionId, gameNumber, toast]);

  return {
    validateClaim,
    rejectClaim,
    isProcessingClaim
  };
}
