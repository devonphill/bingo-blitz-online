
import React from 'react';
import { BingoLogo } from '../ui/bingo-logo';

export interface GameHeaderProps {
  playerName: string;
  playerCode: string;
  currentGameNumber: number;
  numberOfGames: number;
  gameType: string;
  // Adding the props that are being passed from PlayerGameContent
  sessionName?: string;
  accessCode?: string;
  activeWinPattern?: string;
  autoMarking?: boolean;
  setAutoMarking?: (value: boolean) => void;
  isConnected?: boolean;
  connectionState?: 'disconnected' | 'connecting' | 'connected' | 'error';
  onReconnect?: () => void;
}

export default function GameHeader({
  playerName,
  playerCode,
  currentGameNumber,
  numberOfGames,
  gameType,
  // Optional props with defaults
  sessionName,
  accessCode = playerCode,
  activeWinPattern,
  autoMarking,
  setAutoMarking,
  isConnected,
  connectionState = 'connected',
  onReconnect
}: GameHeaderProps) {
  // Format the game type
  const formattedGameType = gameType === 'mainstage' ? '90-Ball' : gameType === '75-ball' ? '75-Ball' : gameType;

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center">
        <BingoLogo className="h-9 w-auto mr-2" />
        <div>
          <h1 className="text-lg font-bold">
            {formattedGameType} Game {currentGameNumber}/{numberOfGames}
          </h1>
          <p className="text-sm text-gray-500">Welcome, {playerName}</p>
        </div>
      </div>
      
      <div className="flex items-center">
        <div className="text-right">
          <span className="text-sm text-gray-500">Player Code:</span>
          <div className="text-md font-mono px-2 py-1 bg-gray-100 rounded">{playerCode}</div>
        </div>
      </div>
    </div>
  );
}
