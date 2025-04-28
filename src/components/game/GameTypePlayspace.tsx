
import React from "react";
import BingoCardDisplay from "./BingoCardDisplay";
import { GameType } from "@/types";
import BingoTicketDisplay from "./BingoTicketDisplay";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface GameTypePlayspaceProps {
  gameType: GameType;
  tickets: any[];
  calledNumbers: number[];
  lastCalledNumber?: number | null;
  autoMarking: boolean;
  setAutoMarking?: (value: boolean) => void;
  handleClaimBingo?: () => Promise<boolean>;
  isClaiming?: boolean;
  claimStatus?: 'pending' | 'validated' | 'rejected';
}

export default function GameTypePlayspace({
  gameType,
  tickets,
  calledNumbers,
  lastCalledNumber,
  autoMarking,
  setAutoMarking,
  handleClaimBingo,
  isClaiming,
  claimStatus
}: GameTypePlayspaceProps) {
  // Debug log to see what ticket data we're receiving
  console.log("GameTypePlayspace tickets:", tickets);
  
  // If it's 90-ball bingo (mainstage), show the ticket display
  if (gameType === 'mainstage') {
    return (
      <div className="grid grid-cols-1 gap-4">
        {tickets.map((ticket: any, index: number) => {
          console.log(`Ticket ${index}:`, { 
            serial: ticket.serial, 
            perm: ticket.perm, 
            position: ticket.position,
            layoutMask: ticket.layoutMask || ticket.layout_mask,
            numbersLength: ticket.numbers?.length || 0
          });
          
          return (
            <div key={ticket.serial || ticket.id || index} className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="text-xs text-gray-600 mb-1">Ticket Serial: <span className="font-mono font-medium">{ticket.serial || `Unknown-${index}`}</span></div>
                  <div className="text-xs text-gray-600 mb-1">Perm: <span className="font-mono font-medium">{ticket.perm || 0}</span></div>
                  <div className="text-xs text-gray-600">Position: <span className="font-mono font-medium">{ticket.position || 0}</span></div>
                </div>
                
                {handleClaimBingo && (
                  <Button 
                    onClick={handleClaimBingo}
                    disabled={isClaiming || claimStatus === 'validated'}
                    className={`px-4 py-2 h-auto ${
                      claimStatus === 'validated' ? 'bg-green-500 text-white' : 
                      claimStatus === 'rejected' ? 'bg-red-500 text-white' :
                      isClaiming ? 'bg-yellow-500 text-white' : 
                      'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {claimStatus === 'validated' ? 'Bingo Verified!' : 
                     claimStatus === 'rejected' ? 'Claim Rejected' :
                     isClaiming ? 'Verifying...' : 'Claim Bingo!'}
                  </Button>
                )}
              </div>
              
              <BingoTicketDisplay
                numbers={ticket.numbers || []}
                layoutMask={ticket.layoutMask || ticket.layout_mask || 0}
                calledNumbers={calledNumbers}
                serial={ticket.serial || `Unknown-${index}`}
                perm={ticket.perm || 0}
                position={ticket.position || 0}
                autoMarking={autoMarking}
                currentWinPattern="oneLine"
                showProgress={true}
              />
            </div>
          );
        })}
        
        {tickets.length === 0 && (
          <div className="p-6 text-center text-gray-500 bg-white rounded-lg shadow">
            No tickets have been assigned to you yet.
          </div>
        )}
      </div>
    );
  }

  // For other game types, show a placeholder
  return (
    <div className="flex items-center justify-center h-full min-h-[400px] bg-white rounded-lg shadow-lg p-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">{gameType.toUpperCase()}</h2>
        <p className="text-gray-600">PLACEHOLDER</p>
      </div>
    </div>
  );
}
