import React, { useState } from 'react';
import { useSessionContext } from '@/contexts/SessionProvider';

const PlayerLobby = () => {
  const { session } = useSessionContext();
  const [ticketCount, setTicketCount] = useState(0);

  const handleBuyTickets = () => {
    console.log(`Player purchased ${ticketCount} tickets (Stripe integration placeholder)`);
    // Update session state or player data with purchased tickets
  };

  return (
    <div>
      <h2>Player Lobby</h2>
      {session ? (
        <>
          <p>Session Name: {session.name}</p>
          <p>Players: {session.players.length}</p>
          <div>
            <input
              type="number"
              value={ticketCount}
              onChange={(e) => setTicketCount(Number(e.target.value))}
              placeholder="Number of tickets"
            />
            <button onClick={handleBuyTickets}>Buy Tickets</button>
          </div>
        </>
      ) : (
        <p>No session found</p>
      )}
    </div>
  );
};

export default PlayerLobby;