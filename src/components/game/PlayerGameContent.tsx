
import React from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { useSessionContext } from '@/contexts/SessionProvider';
import { usePlayerTickets } from '@/hooks/playerTickets/usePlayerTickets';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import BingoTicketDisplay from './BingoTicketDisplay';
import { useGameContext } from '@/contexts/GameContext';

export default function PlayerGameContent() {
  const { player } = usePlayerContext();
  const { currentSession } = useSessionContext();
  const { calledNumbers } = useGameContext();
  const sessionId = player?.sessionId || currentSession?.id;

  // Use the correct properties from usePlayerTickets
  const { 
    playerTickets, 
    isLoadingTickets, 
    ticketError, 
    refreshTickets 
  } = usePlayerTickets(sessionId, player?.id);

  // Handle loading state
  if (isLoadingTickets) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
        <span className="ml-2">Loading your tickets...</span>
      </div>
    );
  }

  // Handle error state
  if (ticketError) {
    return (
      <div className="p-4 bg-red-50 rounded-md">
        <h3 className="text-red-800 font-medium">Error loading tickets</h3>
        <p className="text-red-600 mb-2">{ticketError}</p>
        <Button onClick={() => refreshTickets()} variant="outline" size="sm">
          Try Again
        </Button>
      </div>
    );
  }

  // Handle no tickets state
  if (!playerTickets || playerTickets.length === 0) {
    return (
      <div className="p-4 bg-blue-50 rounded-md">
        <h3 className="text-blue-800 font-medium">No Tickets Available</h3>
        <p className="text-blue-600 mb-2">You don't have any tickets for this game session.</p>
        <Button onClick={() => refreshTickets()} variant="outline" size="sm">
          Check Again
        </Button>
      </div>
    );
  }

  // Display tickets
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Your Tickets</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {playerTickets.map((ticket, index) => (
          <div key={ticket.id || `ticket-${index}`} className="border rounded-md p-2">
            <BingoTicketDisplay
              numbers={ticket.raw_numbers || ticket.numbers_grid || []}
              layoutMask={ticket.layout_mask}
              calledNumbers={calledNumbers}
              serial={ticket.serial_number}
              perm={ticket.perm_number}
              position={ticket.position || 0}
              autoMarking={true}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
