
import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader, Wifi, WifiOff, Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logWithTimestamp } from "@/utils/logUtils";

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
  connectionState?: 'disconnected' | 'connecting' | 'connected' | 'error';
  onReconnect?: () => void;
}

const PlayerList: React.FC<PlayerListProps> = ({ 
  players, 
  isLoading = false,
  connectionState = 'connected',
  onReconnect
}) => {
  // Enhanced logging for component render and state
  useEffect(() => {
    logWithTimestamp(`PlayerList rendering with connectionState: ${connectionState}, players: ${players.length}, isLoading: ${isLoading}`);
  }, [connectionState, players.length, isLoading]);

  // Determine if we're actually connected - this drives the main UI display
  const isConnected = connectionState === 'connected';
  
  // Enhanced status message based on connection state
  const getConnectionMessage = () => {
    switch(connectionState) {
      case 'connected':
        return players.length > 0 
          ? `${players.length} player${players.length > 1 ? 's' : ''} connected` 
          : 'Connected to game server, waiting for players';
      case 'connecting':
        return 'Connecting to game server...';
      case 'error':
        return 'Connection error with game server';
      default:
        return 'Disconnected from game server';
    }
  };

  if (isLoading) {
    return (
      <div className="text-amber-500 text-center py-4 flex flex-col items-center gap-2">
        <Loader className="h-5 w-5 animate-spin" />
        <span>Connecting to game server...</span>
      </div>
    );
  }

  // Connection status messaging
  if (connectionState === 'error' || connectionState === 'disconnected') {
    return (
      <div className="text-red-500 text-center py-4 flex flex-col items-center gap-2">
        <WifiOff className="h-5 w-5" />
        <span>Disconnected from game server</span>
        <span className="text-xs">Players may not appear until connection is restored</span>
        {onReconnect && (
          <Button 
            size="sm" 
            variant="outline" 
            className="mt-2 flex items-center gap-1"
            onClick={onReconnect}
          >
            <RefreshCw className="h-3 w-3" />
            Reconnect
          </Button>
        )}
      </div>
    );
  }

  if (!players || players.length === 0) {
    return (
      <div className="text-gray-500 text-center py-4 flex flex-col items-center gap-2">
        {connectionState === 'connecting' ? (
          <>
            <Loader className="h-5 w-5 animate-spin" />
            <span>Waiting for players to connect...</span>
          </>
        ) : isConnected ? (
          <>
            <Users className="h-5 w-5" />
            <span>No players have joined yet. Share the access code.</span>
          </>
        ) : (
          <>
            <WifiOff className="h-5 w-5" />
            <span>Check connection status. No players currently visible.</span>
            {onReconnect && (
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-2 flex items-center gap-1"
                onClick={onReconnect}
              >
                <RefreshCw className="h-3 w-3" />
                Reconnect
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-500">Connected players ({players.length})</span>
        <Badge variant="outline" className={`text-xs ${
          isConnected 
            ? 'bg-green-100 text-green-800 border-green-200' 
            : connectionState === 'connecting'
            ? 'bg-amber-100 text-amber-800 border-amber-200'
            : 'bg-red-100 text-red-800 border-red-200'
        }`}>
          {isConnected ? 'Server Connected' : connectionState === 'connecting' ? 'Connecting...' : 'Disconnected'}
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
