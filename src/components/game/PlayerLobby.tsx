
import React, { useState, useEffect } from 'react';
import { useSessionContext } from '@/contexts/SessionProvider';
import { useGameManager } from '@/contexts/GameManager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { RefreshCw } from 'lucide-react';
import { GameSession } from '@/types';

interface PlayerLobbyProps {
  onRefreshStatus?: () => void;
  sessionName?: string;
  playerName?: string;
  sessionId?: string;
  errorMessage?: string | null;
}

interface SessionData {
  name?: string;
  id?: string;
  gameType?: string;
  status?: string;
  lifecycle_state?: string;
}

const PlayerLobby: React.FC<PlayerLobbyProps> = ({
  onRefreshStatus,
  sessionName,
  playerName,
  sessionId,
  errorMessage
}) => {
  const { session, players } = useSessionContext();
  const { getGameTypeById } = useGameManager();
  const [ticketCount, setTicketCount] = useState(0);
  const [gameTypeDetails, setGameTypeDetails] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get active session from context or use the provided sessionId
  const activeSession: SessionData = session || { 
    name: sessionName, 
    id: sessionId,
    gameType: session?.gameType || undefined
  };
  
  useEffect(() => {
    if (activeSession?.gameType) {
      const gameType = getGameTypeById(activeSession.gameType);
      setGameTypeDetails(gameType);
    }
  }, [activeSession, getGameTypeById]);

  const handleBuyTickets = () => {
    console.log(`Player purchased ${ticketCount} tickets (Stripe integration placeholder)`);
    // Update session state or player data with purchased tickets
  };

  const handleRefreshStatus = () => {
    if (onRefreshStatus) {
      setIsRefreshing(true);
      Promise.resolve(onRefreshStatus())
        .finally(() => {
          setTimeout(() => setIsRefreshing(false), 1000);
        });
    }
  };

  if (!activeSession) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Player Lobby</h2>
        <p>No active session found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-t-lg">
          <CardTitle className="text-2xl">Game Lobby</CardTitle>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-800">{activeSession.name || "Game Session"}</h2>
            <p className="text-gray-600">Waiting for the host to start the game</p>
            
            <div className="mt-6 mb-6 flex justify-center">
              <Spinner size="lg" />
            </div>
            
            {playerName && (
              <div className="bg-blue-50 p-3 rounded-lg inline-block">
                <span className="font-semibold">Playing as:</span> {playerName}
              </div>
            )}
          </div>
          
          <div className="border-t border-b py-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Game Type:</span>
              <span className="font-semibold">
                {gameTypeDetails?.name || activeSession.gameType || "Standard"}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Players:</span>
              <span className="font-semibold">{players?.length || 0}</span>
            </div>
            
            {errorMessage && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mt-4 text-amber-700 text-sm">
                {errorMessage}
                <p className="text-xs mt-1">You'll still be able to join when the game starts.</p>
              </div>
            )}
          </div>

          {/* Ticket purchase UI */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2 text-gray-700">Purchase Tickets</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="number"
                value={ticketCount}
                onChange={(e) => setTicketCount(Number(e.target.value))}
                placeholder="Number of tickets"
                min="1"
                className="border rounded-md px-3 py-2 flex-1"
              />
              <Button onClick={handleBuyTickets} disabled={ticketCount <= 0} className="whitespace-nowrap">
                Buy Tickets
              </Button>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-center bg-gray-50 rounded-b-lg">
          <Button 
            variant="outline" 
            className="w-full flex items-center justify-center gap-2"
            onClick={handleRefreshStatus}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Checking status...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Refresh Game Status
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PlayerLobby;
