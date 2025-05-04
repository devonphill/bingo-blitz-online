
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
  // Use a ref to avoid stale closures in event handlers
  const playersRef = React.useRef(initialPlayers);
  
  // Update ref when players prop changes
  React.useEffect(() => {
    playersRef.current = initialPlayers;
  }, [initialPlayers]);

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
    
    // Only add listener for players updates from connectionManager
    // This ensures we don't create a new channel, we just listen to the existing one
    const playersUpdateCallback = (activePlayers: any[]) => {
      if (!isMounted.current) return;
      
      if (activePlayers && activePlayers.length > 0) {
        logWithTimestamp(`PlayerList: Received ${activePlayers.length} active players update`);
        
        // Only set players if they've actually changed to avoid render loops
        if (JSON.stringify(activePlayers) !== JSON.stringify(playersRef.current)) {
          setPlayers(activePlayers);
          playersRef.current = activePlayers;
        }
        
        setIsLoading(false);
      }
    };

    // Add the callback to the connection manager
    connectionManager.onPlayersUpdate(playersUpdateCallback);
    
    // Initial players load from database - only once on mount
    const fetchPlayers = async () => {
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
          
          // Only update if the component is still mounted
          setPlayers(formattedPlayers);
          playersRef.current = formattedPlayers;
          logWithTimestamp(`PlayerList: Fetched ${formattedPlayers.length} players from database`);
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
    fetchPlayers();
    
    // Request a reconnect to ensure we're connected to the latest data
    // This will trigger presence updates through the existing channel
    connectionManager.reconnect();
    
    // Cleanup - we don't remove the callback since connectionManager is a singleton
    // and other components may rely on the same channel
    return () => {
      // Nothing to do here - connectionManager handles cleanup
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
            Refresh Players
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-500">Connected players ({players.length})</span>
        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
          {players.length} Online
        </Badge>
      </div>

      {players.map((player, idx) => (
        <div key={player.id || player.clientId || player.playerCode || idx} className="bg-gray-50 p-3 rounded-md">
          <div className="font-medium flex items-center justify-between">
            {player.nickname || player.playerName || player.playerCode}
            <Badge variant="outline" className="text-xs ml-1 bg-green-50 text-green-700 border-green-200">
              Online
            </Badge>
          </div>
          <div className="text-xs text-gray-500">
            Joined {player.joinedAt ? new Date(player.joinedAt).toLocaleTimeString() : 'recently'}
          </div>
          <div className="text-xs font-mono mt-1">
            Code: {player.playerCode}
          </div>
          {player.tickets !== undefined && (
            <div className="text-xs mt-1">
              Tickets: {player.tickets}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default PlayerList;
