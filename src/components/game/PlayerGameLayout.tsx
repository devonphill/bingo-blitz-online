
import React, { useState } from "react";
import { PlayerGameContent } from "./PlayerGameContent";
import { Menu, X } from "lucide-react";
import { Button } from "../ui/button";

interface PlayerGameLayoutProps {
  children?: React.ReactNode;
  tickets: any[];
  calledNumbers?: number[];
  currentNumber?: number | null;
  currentSession?: any;
  autoMarking?: boolean;
  setAutoMarking?: (value: boolean) => void;
  playerCode?: string;
  playerName?: string;
  winPrizes?: Record<string, string>;
  activeWinPatterns?: string[];
  onClaimBingo?: () => Promise<boolean>;
  claimStatus?: 'none' | 'pending' | 'valid' | 'invalid';
  isClaiming?: boolean;
  errorMessage?: string;
  isLoading?: boolean;
  gameType?: string;
  currentWinPattern?: string | null;
  currentGameNumber?: number;
  numberOfGames?: number;
  connectionState?: 'disconnected' | 'connecting' | 'connected' | 'error';
  onRefreshTickets?: () => void;
  sessionId?: string;
}

export default function PlayerGameLayout({
  children,
  tickets = [],
  calledNumbers = [],
  currentNumber = null,
  currentSession,
  autoMarking = true,
  setAutoMarking,
  playerCode,
  playerName,
  winPrizes = {},
  activeWinPatterns = [],
  onClaimBingo,
  claimStatus = 'none',
  isClaiming = false,
  errorMessage,
  isLoading,
  gameType = 'mainstage',
  currentWinPattern = null,
  currentGameNumber = 1,
  numberOfGames = 1,
  connectionState = 'connected',
  onRefreshTickets,
  sessionId
}: PlayerGameLayoutProps) {
  // Add state for sidebar visibility - closed by default
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex relative">
      {/* Sidebar toggle button - fixed position */}
      <Button 
        variant="outline" 
        size="icon"
        className="fixed top-4 left-4 z-50 bg-white shadow-md rounded-full"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </Button>
      
      {/* Sidebar - hidden by default */}
      <div 
        className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out 
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          bg-white shadow-lg`}
      >
        <div className="p-4 pt-16 h-full overflow-y-auto">
          <h3 className="font-bold text-lg mb-4">Game Info</h3>
          <div className="space-y-4">
            <div className="border-b pb-2">
              <p className="text-sm text-gray-500">Player</p>
              <p className="font-medium">{playerName || 'Guest'}</p>
            </div>
            
            <div className="border-b pb-2">
              <p className="text-sm text-gray-500">Game</p>
              <p className="font-medium">{currentGameNumber} of {numberOfGames}</p>
            </div>
            
            <div className="border-b pb-2">
              <p className="text-sm text-gray-500">Game Type</p>
              <p className="font-medium">{gameType === 'mainstage' ? '90 Ball Bingo' : gameType}</p>
            </div>
            
            <div className="border-b pb-2">
              <p className="text-sm text-gray-500">Pattern</p>
              <p className="font-medium">{currentWinPattern || 'Not set'}</p>
            </div>
            
            <div className="border-b pb-2">
              <p className="text-sm text-gray-500">Tickets</p>
              <p className="font-medium">{tickets.length}</p>
            </div>
            
            <div className="border-b pb-2">
              <p className="text-sm text-gray-500">Called Numbers</p>
              <p className="font-medium">{calledNumbers.length}</p>
            </div>
            
            <div className="border-b pb-2">
              <p className="text-sm text-gray-500">Last Called</p>
              <p className="font-medium">{currentNumber || '-'}</p>
            </div>
            
            <div className="border-b pb-2">
              <p className="text-sm text-gray-500">Connection</p>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  connectionState === 'connected' ? 'bg-green-500' : 
                  connectionState === 'connecting' ? 'bg-amber-500' : 'bg-red-500'
                }`}></div>
                <p className="font-medium capitalize">{connectionState}</p>
              </div>
            </div>
          </div>
          
          {onRefreshTickets && (
            <Button 
              onClick={onRefreshTickets}
              variant="outline" 
              size="sm"
              className="mt-4 w-full"
            >
              Refresh Tickets
            </Button>
          )}
        </div>
      </div>
      
      {/* Main content - full width */}
      <div className="flex-1">
        <PlayerGameContent 
          tickets={tickets}
          calledNumbers={calledNumbers}
          currentNumber={currentNumber}
          currentSession={currentSession}
          autoMarking={autoMarking}
          setAutoMarking={setAutoMarking}
          playerCode={playerCode}
          playerName={playerName}
          winPrizes={winPrizes}
          activeWinPatterns={activeWinPatterns}
          onClaimBingo={onClaimBingo}
          claimStatus={claimStatus}
          isClaiming={isClaiming}
          gameType={gameType}
          currentWinPattern={currentWinPattern}
          currentGameNumber={currentGameNumber}
          numberOfGames={numberOfGames}
          backgroundColor="white"
          connectionState={connectionState}
          onRefreshTickets={onRefreshTickets}
          onReconnect={onRefreshTickets}
        >
          {children}
        </PlayerGameContent>
      </div>
    </div>
  );
}
