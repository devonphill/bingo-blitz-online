
import React, { useState, useEffect } from 'react';
import { useSessionContext } from '@/contexts/SessionProvider';
import { useGameManager } from '@/contexts/GameManager';
import { Button } from '@/components/ui/button';

const PlayerLobby = () => {
  const { session, players } = useSessionContext();
  const { getGameTypeById } = useGameManager();
  const [ticketCount, setTicketCount] = useState(0);
  const [gameTypeDetails, setGameTypeDetails] = useState<any>(null);

  useEffect(() => {
    if (session?.gameType) {
      const gameType = getGameTypeById(session.gameType);
      setGameTypeDetails(gameType);
    }
  }, [session, getGameTypeById]);

  const handleBuyTickets = () => {
    console.log(`Player purchased ${ticketCount} tickets (Stripe integration placeholder)`);
    // Update session state or player data with purchased tickets
  };

  if (!session) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Player Lobby</h2>
        <p>No active session found</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Player Lobby</h2>
      
      <div className="grid gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="font-medium">Session: {session.name}</p>
          <p>Game Type: {gameTypeDetails?.name || session.gameType}</p>
          <p>Players: {players?.length || 0}</p>
          {gameTypeDetails?.rules && (
            <div className="mt-2 text-sm">
              <p>Max Players: {gameTypeDetails.rules.maxPlayers}</p>
              <p>Win Condition: {gameTypeDetails.rules.winCondition}</p>
            </div>
          )}
        </div>

        <div className="border p-4 rounded-lg">
          <h3 className="font-medium mb-2">Purchase Tickets</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="number"
              value={ticketCount}
              onChange={(e) => setTicketCount(Number(e.target.value))}
              placeholder="Number of tickets"
              min="1"
              className="border rounded-md px-3 py-2"
            />
            <Button onClick={handleBuyTickets} disabled={ticketCount <= 0}>
              Buy Tickets
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerLobby;
