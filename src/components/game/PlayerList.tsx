
import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader, Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
}

const PlayerList: React.FC<PlayerListProps> = ({ 
  players, 
  isLoading = false,
  onReconnect
}) => {
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
