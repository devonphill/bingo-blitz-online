
import React from 'react';
import { Button } from "@/components/ui/button";
import { Loader, CheckCircle, XCircle, Share2 } from 'lucide-react';
import CallerTicketDisplay from './CallerTicketDisplay';
import { ClaimData } from '@/types/claim';
import { claimBroadcastService } from '@/services/ClaimBroadcastService';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { toast as sonnerToast } from 'sonner';

interface ClaimItemProps {
  claim: ClaimData;
  currentCalledNumbers: number[];
  currentNumber: number | null;
  gameType: string;
  currentWinPattern: string | null;
  onVerify: (claim: ClaimData) => Promise<void>;
  onReject: (claim: ClaimData) => Promise<void>;
  isProcessingClaim: boolean;
}

export default function ClaimItem({
  claim,
  currentCalledNumbers,
  currentNumber,
  gameType,
  currentWinPattern,
  onVerify,
  onReject,
  isProcessingClaim
}: ClaimItemProps) {
  const { toast } = useToast();
  const [isSendingToPlayers, setIsSendingToPlayers] = React.useState(false);
  
  // Enhanced broadcasting to ensure claim checks reach players
  const handleSendToPlayers = async () => {
    setIsSendingToPlayers(true);
    try {
      logWithTimestamp(`ClaimItem: Broadcasting claim check for ${claim.playerName || claim.playerId}`, 'info');
      
      // Ensure we have properly formatted data for broadcasting
      const enhancedClaim = {
        ...claim,
        calledNumbers: currentCalledNumbers,
        lastCalledNumber: currentNumber,
        winPattern: claim.winPattern || currentWinPattern,
        gameType: claim.gameType || gameType,
        ticket: claim.ticket ? {
          ...claim.ticket,
          calledNumbers: currentCalledNumbers
        } : null
      };
      
      // More reliable broadcasting with multiple attempts if needed
      let success = false;
      let attempts = 0;
      const maxAttempts = 2;
      
      while (!success && attempts < maxAttempts) {
        attempts++;
        logWithTimestamp(`ClaimItem: Broadcast attempt ${attempts} for claim ${claim.id}`, 'info');
        
        success = await claimBroadcastService.broadcastClaimChecking(
          enhancedClaim,
          claim.sessionId
        );
        
        if (!success && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retry
        }
      }
      
      if (success) {
        logWithTimestamp(`ClaimItem: Successfully broadcasted claim check`, 'info');
        
        // Trigger global events for better coordination
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          const event = new CustomEvent('forceOpenClaimDrawer', { 
            detail: { data: enhancedClaim }
          });
          window.dispatchEvent(event);
          
          // Also dispatch a custom event that other components might listen to
          const broadcastEvent = new CustomEvent('claimBroadcast', {
            detail: { claim: enhancedClaim, type: 'checking' }
          });
          window.dispatchEvent(broadcastEvent);
        }
        
        // Show confirmation using both toast systems for maximum visibility
        toast({
          title: "Sent to All Players",
          description: `Claim by ${claim.playerName || claim.playerId} shared with all players`,
          duration: 3000,
        });
        
        sonnerToast.success("Claim sent to players", {
          description: `${claim.playerName || claim.playerId}'s ticket is now visible to everyone`
        });
      } else {
        throw new Error(`Failed to broadcast claim after ${maxAttempts} attempts`);
      }
    } catch (error) {
      console.error("Error broadcasting claim to players:", error);
      
      toast({
        title: "Broadcast Error",
        description: "Failed to send claim to players. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsSendingToPlayers(false);
    }
  };

  return (
    <div className="border rounded-md p-4">
      <div className="font-bold">Claim Details</div>
      <div>Player: {claim.playerName || claim.playerId}</div>
      <div>Session: {claim.sessionId?.substring(0, 8)}...</div>
      <div>Game: {claim.gameNumber || "Unknown"}</div>
      <div>Pattern: {claim.winPattern || currentWinPattern}</div>
      <div>Claimed at: {new Date(claim.timestamp).toLocaleTimeString()}</div>
      
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
            calledNumbers={currentCalledNumbers || (claim.calledNumbers || [])}
            lastCalledNumber={currentNumber || claim.lastCalledNumber}
            gameType={gameType}
            winPattern={currentWinPattern || claim.winPattern}
          />
        </div>
      )}
      
      <div className="flex flex-wrap justify-end gap-2 mt-4">
        <Button 
          variant="outline"
          onClick={handleSendToPlayers}
          disabled={isSendingToPlayers || isProcessingClaim}
          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
          size="sm"
        >
          {isSendingToPlayers ? (
            <Loader className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Share2 className="h-4 w-4 mr-2" />
          )}
          Send to Players
        </Button>
        <Button 
          variant="outline" 
          onClick={() => onVerify(claim)}
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
          onClick={() => onReject(claim)}
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
  );
}
