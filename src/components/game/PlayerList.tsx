import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader, Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectionManager } from "@/utils/connectionManager";
import { logWithTimestamp } from "@/utils/logUtils";
import { supabase } from "@/integrations/supabase/client";

export interface PlayerListProps {
  players: {
    id?: string;
    nickname?: string;
    joinedAt?: string;
    playerCode: string;
    playerName?: string;
    tickets?: number;
    clientId?: string;
  }[];
  isLoading?: boolean;
  onReconnect?: () => void;
  sessionId?: string;
}

const PlayerList: React.FC<PlayerListProps> = ({ 
  players: initialPlayers = [], 
  isLoading: initialLoading = false,
  onReconnect,
  sessionId
}) => {
  const [players, setPlayers] = useState(initialPlayers);
  const [isLoading, setIsLoading] = useState(initialLoading);
  
  // Use a ref to keep track of the last known players to prevent redundant updates
  const lastPlayersRef = React.useRef<string>('');
  
  // Track if component is mounted
  const isMounted = React.useRef(true);
  
  React.useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Fetch players and set up presence tracking, using the single connection method
  useEffect(() => {
    if (!sessionId) return;
    
    setIsLoading(true);
    
    // Define callback to handle player updates from connection manager
    const handlePlayersUpdate = (activePlayers: any[]) => {
      if (!isMounted.current) return;
      
      if (activePlayers?.length >= 0) {
        logWithTimestamp(`PlayerList: Received ${activePlayers.length} active players update`);
        
        // Format the player data for display
        const formattedPlayers = activePlayers.map(player => ({
          id: player.id || player.user_id,
          clientId: player.clientId || player.client_id,
          playerCode: player.playerCode || player.player_code,
          playerName: player.nickname || player.playerName || player.player_code,
          nickname: player.nickname || player.playerName || player.playerCode || player.player_code,
          joinedAt: player.joinedAt || player.joined_at || new Date().toISOString(),
          tickets: player.tickets
        }));
        
        // Create a string representation for comparison
        const currentPlayersJson = JSON.stringify(formattedPlayers);
        
        // Only update state if players have actually changed
        if (currentPlayersJson !== lastPlayersRef.current) {
          lastPlayersRef.current = currentPlayersJson;
          setPlayers(formattedPlayers);
          logWithTimestamp(`PlayerList: Updated with ${formattedPlayers.length} players`);
        }
        
        setIsLoading(false);
      }
    };

    // Register the callback with connection manager
    // We'll only register it once, avoiding multiple handlers
    connectionManager.onPlayersUpdate(handlePlayersUpdate);
    
    // Initial players load from database
    const fetchInitialPlayers = async () => {
      try {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('session_id', sessionId);

        if (error) {
          console.error('Error fetching players:', error);
          return;
        }

        if (data && isMounted.current) {
          // Format the players data
          const formattedPlayers = data.map(p => ({
            id: p.id,
            nickname: p.nickname,
            playerCode: p.player_code,
            playerName: p.nickname,
            joinedAt: p.joined_at,
            tickets: p.tickets
          }));
          
          // Set players if we got data
          const currentPlayersJson = JSON.stringify(formattedPlayers);
          if (currentPlayersJson !== lastPlayersRef.current) {
            lastPlayersRef.current = currentPlayersJson;
            setPlayers(formattedPlayers);
            logWithTimestamp(`PlayerList: Loaded ${formattedPlayers.length} players from database`);
          }
        }
      } catch (err) {
        console.error('Error in player fetch:', err);
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    };

    // Execute the fetch
    fetchInitialPlayers();
    
    return () => {
      // No explicit cleanup needed for the connection manager callbacks
      // as we're not adding new handlers on each render
    };
  }, [sessionId]);

  // Simple loading state
  if (isLoading) {
    return (
      <div className="text-amber-500 text-center py-4 flex flex-col items-center gap-2">
        <Loader className="h-5 w-5 animate-spin" />
        <span>Loading players...</span>
      </div>
    );
  }

  // No players state
  if (!players || players.length === 0) {
    return (
      <div className="text-gray-500 text-center py-4 flex flex-col items-center gap-2">
        <Users className="h-5 w-5" />
        <span>No players have joined yet</span>
        {onReconnect && (
          <Button 
            size="sm" 
            variant="outline" 
            className="mt-2 flex items-center gap-1"
            onClick={onReconnect}
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        )}
      </div>
    );
  }

  // Display connected players
  return (
    <div className="max-h-40 overflow-y-auto">
      <ul className="divide-y divide-gray-100">
        {players.map((player, index) => (
          <li key={player.id || player.playerCode || index} className="py-1.5 flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-sm">{player.nickname || player.playerName || player.playerCode}</span>
            </div>
            <Badge className="bg-green-500 text-white text-xs">online</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PlayerList;
