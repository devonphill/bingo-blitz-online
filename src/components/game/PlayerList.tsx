
import React from "react";

export interface PlayerListProps {
  players: {
    id: string;
    nickname: string;
    joinedAt: string;
    playerCode: string;
    tickets?: number;
  }[];
}

const PlayerList: React.FC<PlayerListProps> = ({ players }) => {
  if (players.length === 0) {
    return (
      <div className="text-gray-500 text-center py-4">
        No players have joined yet. Share the access code.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
      {players.map((player) => (
        <div key={player.id} className="bg-gray-50 p-3 rounded-md">
          <div className="font-medium">{player.nickname}</div>
          <div className="text-xs text-gray-500">
            Joined {new Date(player.joinedAt).toLocaleTimeString()}
          </div>
          <div className="text-xs font-mono mt-1">
            Code: {player.playerCode}
          </div>
          {player.tickets && (
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
