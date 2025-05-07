
import React from "react";
import BingoCardDisplay from "./BingoCardDisplay";
import BingoTicketDisplay from "./BingoTicketDisplay";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSafeId } from "@/utils/reactUtils";

interface GameTypePlayspaceProps {
  gameType: string;
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
  // Generate unique IDs for this component
  const playspaceId = useSafeId('playspace-');
  
  // Debug log to see what ticket data we're receiving
  console.log("GameTypePlayspace tickets:", tickets);
  
  // Render content based on game type
  const renderGameContent = () => {
    switch(gameType) {
      case 'mainstage':
        return renderMainstageContent();
      case 'party':
        return renderPartyContent();
      case 'quiz':
        return renderQuizContent();
      case 'logo':
        return renderLogoContent();
      case 'music':
        return renderMusicContent();
      default:
        return renderDefaultContent();
    }
  };
  
  // Mainstage (90 Ball Bingo)
  const renderMainstageContent = () => {
    return (
      <div className="grid grid-cols-1 gap-4">
        {tickets.map((ticket: any, index: number) => {
          // Generate a stable ticket ID
          const ticketId = useSafeId(`ticket-${ticket.serial || index}-`);
          
          return (
            <div key={ticketId} className="bg-white p-4 rounded-lg shadow">
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
  };
  
  // Party (80 Ball Bingo)
  const renderPartyContent = () => {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Party Bingo (80 Ball)</h2>
          <p className="text-gray-600 mb-4">This game type is coming soon!</p>
          <div className="grid grid-cols-1 gap-4 max-w-md mx-auto">
            {tickets.length > 0 ? (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p>{tickets.length} tickets assigned</p>
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p>No tickets assigned yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // Quiz Bingo
  const renderQuizContent = () => {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Quiz Bingo</h2>
          <p className="text-gray-600 mb-4">Answer questions to mark your card!</p>
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-md">
            <p>Quiz questions will appear here during the game</p>
          </div>
        </div>
      </div>
    );
  };
  
  // Logo Bingo
  const renderLogoContent = () => {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Logo Bingo</h2>
          <p className="text-gray-600 mb-4">Match company logos to their names!</p>
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <p>Logos will appear here during the game</p>
          </div>
        </div>
      </div>
    );
  };
  
  // Music Bingo
  const renderMusicContent = () => {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Music Bingo</h2>
          <p className="text-gray-600 mb-4">Identify songs and mark your card!</p>
          <div className="p-4 bg-pink-50 border border-pink-200 rounded-md">
            <p>Music clips will play during the game</p>
          </div>
        </div>
      </div>
    );
  };
  
  // Default content for unknown game types
  const renderDefaultContent = () => {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">{gameType.toUpperCase()}</h2>
          <p className="text-gray-600">Unknown game type</p>
        </div>
      </div>
    );
  };

  return renderGameContent();
}
