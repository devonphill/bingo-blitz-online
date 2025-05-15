
import React from 'react';
import { Button } from '@/components/ui/button';

export interface PlayerGameContentProps {
  tickets: any[];
  currentSession: any;
  autoMarking: boolean;
  setAutoMarking: (value: boolean) => void;
  playerCode: string;
  playerName?: string;
  playerId?: string;
  onRefreshTickets: () => void;
  onReconnect: () => void;
  sessionId?: string | null;
  showLobby?: boolean;
  lobbyComponent?: React.ReactNode;
  claimCount?: number;
  winPatterns?: any[];
  isClaimable?: boolean;
  onClaimWin?: () => void;
  calledNumbers?: number[];
  currentNumber?: number;
}

export const PlayerGameContent: React.FC<PlayerGameContentProps> = ({
  tickets,
  currentSession,
  autoMarking,
  setAutoMarking,
  playerCode,
  playerName,
  playerId,
  onRefreshTickets,
  onReconnect,
  sessionId,
  showLobby,
  lobbyComponent,
  claimCount,
  winPatterns,
  isClaimable,
  onClaimWin,
  calledNumbers,
  currentNumber,
}) => {
  // If lobby should be shown, render the lobby component
  if (showLobby && lobbyComponent) {
    return <>{lobbyComponent}</>;
  }

  // Default game content
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-md p-4">
        <h2 className="text-xl font-bold mb-2">Game Session: {currentSession?.name}</h2>
        <p className="text-sm text-gray-600">Player: {playerName || playerCode}</p>
        <p className="text-sm text-gray-600">Game Type: {currentSession?.gameType}</p>
      </div>

      {/* Display tickets if available */}
      {tickets && tickets.length > 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">You have {tickets.length} ticket(s)</p>
          
          {/* Render tickets here */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tickets.map((ticket, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-2 border-2 border-gray-200">
                <h3 className="text-md font-semibold">Ticket #{index + 1}</h3>
                <p className="text-xs text-gray-500">ID: {ticket.id}</p>
                {/* Ticket content would go here */}
              </div>
            ))}
          </div>

          {/* Game controls */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onRefreshTickets}>
                Refresh Tickets
              </Button>
              
              <Button variant="outline" onClick={onReconnect}>
                Reconnect
              </Button>

              {isClaimable && onClaimWin && (
                <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={onClaimWin}>
                  Claim Win!
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-4 text-center">
          <p>No tickets assigned yet.</p>
          <Button 
            variant="outline" 
            className="mt-2"
            onClick={onRefreshTickets}
          >
            Check for Tickets
          </Button>
        </div>
      )}

      {/* Display current game information */}
      {currentNumber && (
        <div className="bg-white rounded-lg shadow-md p-4 text-center">
          <h3 className="text-xl font-bold">Current Number</h3>
          <div className="text-4xl font-bold text-blue-600 my-2">{currentNumber}</div>
        </div>
      )}
      
      {calledNumbers && calledNumbers.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-md font-semibold mb-2">Called Numbers</h3>
          <div className="flex flex-wrap gap-1">
            {calledNumbers.map((number) => (
              <span key={number} className="inline-block bg-gray-100 px-2 py-1 rounded text-sm">
                {number}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
