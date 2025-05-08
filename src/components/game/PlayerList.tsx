
import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { BingoClaim } from '@/services/ClaimManagementService';

interface PlayerListProps {
  players: any[];
  isLoading?: boolean;
  onReconnect?: () => void;
  sessionId?: string;
  claimsData?: BingoClaim[];
}

export default function PlayerList({ 
  players = [], 
  isLoading = false, 
  onReconnect,
  sessionId,
  claimsData = []
}: PlayerListProps) {
  const [playersList, setPlayersList] = useState<any[]>([]);
  
  // Merge players with claims data
  useEffect(() => {
    // Create a map of player IDs with claims
    const playerClaimsMap = new Map();
    if (claimsData && claimsData.length > 0) {
      claimsData.forEach(claim => {
        playerClaimsMap.set(claim.playerId, claim);
      });
    }
    
    // Update players with claim status
    const updatedPlayers = players.map(player => ({
      ...player,
      hasClaim: playerClaimsMap.has(player.id),
      claim: playerClaimsMap.get(player.id)
    }));
    
    setPlayersList(updatedPlayers);
  }, [players, claimsData]);
  
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-5 bg-gray-200 rounded w-3/4"></div>
        <div className="h-5 bg-gray-200 rounded w-full"></div>
        <div className="h-5 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }
  
  if (players.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        <p className="mb-2">No players connected</p>
        {onReconnect && (
          <button 
            onClick={onReconnect}
            className="text-sm text-blue-500 hover:underline"
          >
            Refresh players
          </button>
        )}
      </div>
    );
  }
  
  return (
    <div className="max-h-48 overflow-y-auto">
      <ul className="space-y-1">
        {playersList.map((player, index) => (
          <li key={player.id || index} className="text-sm flex items-center justify-between">
            <div className="truncate">
              {player.nickname || player.player_code || player.name || 'Unknown player'}
            </div>
            <div className="flex items-center gap-1">
              {player.hasClaim && (
                <Badge variant="destructive" className="animate-pulse">
                  CLAIM
                </Badge>
              )}
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Online
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
