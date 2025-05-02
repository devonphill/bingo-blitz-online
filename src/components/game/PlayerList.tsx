
import React from "react";
import { Badge } from "@/components/ui/badge";

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
}

const PlayerList: React.FC<PlayerListProps> = ({ players, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="text-amber-500 text-center py-4">
        Connecting to game server...
      </div>
    );
  }

  if (!players || players.length === 0) {
    return (
      <div className="text-gray-500 text-center py-4">
        No players have joined yet. Share the access code.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
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
