
import React from 'react';
import { Button } from "@/components/ui/button";
import { Loader, CheckCircle, XCircle } from 'lucide-react';
import CallerTicketDisplay from './CallerTicketDisplay';
import { ClaimData } from '@/types/claim';

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
  return (
    <div className="border rounded-md p-4">
      <div className="font-bold">Claim Details</div>
      <div>Player: {claim.playerName || claim.playerId}</div>
      <div>Session: {claim.sessionId?.substring(0, 8)}...</div>
      <div>Game: {claim.gameNumber}</div>
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
            calledNumbers={currentCalledNumbers || claim.calledNumbers || []}
            lastCalledNumber={currentNumber || claim.lastCalledNumber}
            gameType={gameType}
            winPattern={currentWinPattern || claim.winPattern}
          />
        </div>
      )}
      
      <div className="flex justify-end gap-2 mt-4">
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
