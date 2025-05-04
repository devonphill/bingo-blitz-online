
import React from 'react';
import CurrentNumberDisplay from '@/components/game/CurrentNumberDisplay';
import GameHeader from '@/components/game/GameHeader';
import BingoClaim from '@/components/game/BingoClaim';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent
} from "@/components/ui/sidebar";

interface PlayerGameLayoutProps {
  tickets: any[];
  calledNumbers: number[];
  currentNumber: number | null;
  currentSession: any;
  autoMarking: boolean;
  setAutoMarking: (value: boolean) => void;
  playerCode: string;
  playerName: string;
  winPrizes: Record<string, string>;
  activeWinPatterns: string[];
  currentWinPattern: string | null;
  onClaimBingo: () => Promise<boolean>;
  errorMessage: string;
  isLoading: boolean;
  isClaiming: boolean;
  claimStatus: 'none' | 'pending' | 'valid' | 'invalid';
  gameType: string;
  children: React.ReactNode;
  currentGameNumber: number; 
  numberOfGames: number;
  connectionState?: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export default function PlayerGameLayout({
  tickets,
  calledNumbers,
  currentNumber,
  currentSession,
  autoMarking,
  setAutoMarking,
  playerCode,
  playerName,
  winPrizes,
  activeWinPatterns,
  currentWinPattern,
  onClaimBingo,
  errorMessage,
  isLoading,
  isClaiming,
  claimStatus,
  gameType,
  children,
  currentGameNumber,
  numberOfGames,
  connectionState = 'connected'
}: PlayerGameLayoutProps) {
  const resetClaimStatus = () => {}; // This is handled by the usePlayerGame hook
  
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="w-full flex min-h-screen bg-gray-100">
        <Sidebar>
          <SidebarContent>
            {/* Game Information */}
            <SidebarGroup>
              <SidebarGroupLabel>Game Information</SidebarGroupLabel>
              <SidebarGroupContent className="space-y-3 px-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Game Type:</span>
                  <span className="font-medium">{gameType === 'mainstage' ? '90-Ball' : gameType}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Game:</span>
                  <span className="font-medium">{currentGameNumber} of {numberOfGames}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Called Numbers:</span>
                  <span className="font-medium">{calledNumbers.length}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Win Pattern:</span>
                  <span className="font-medium">{currentWinPattern || 'Full House'}</span>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Connection Status */}
            <SidebarGroup>
              <SidebarGroupLabel>Connection</SidebarGroupLabel>
              <SidebarGroupContent>
                <div className={`rounded-md py-2 px-4 mb-4 text-center text-sm ${
                  connectionState === 'connected' ? 'bg-green-50 text-green-700' :
                  connectionState === 'connecting' ? 'bg-blue-50 text-blue-700' :
                  'bg-red-50 text-red-700'
                }`}>
                  <div className="flex items-center justify-center">
                    <div className={`h-2 w-2 rounded-full mr-2 ${
                      connectionState === 'connected' ? 'bg-green-500' :
                      connectionState === 'connecting' ? 'bg-blue-500' :
                      'bg-red-500'
                    }`}></div>
                    <span>
                      {connectionState === 'connected' ? 'Connected' :
                      connectionState === 'connecting' ? 'Connecting...' :
                      'Disconnected'}
                    </span>
                  </div>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Recent Numbers */}
            <SidebarGroup>
              <SidebarGroupLabel>Recent Numbers</SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="grid grid-cols-5 gap-2">
                  {calledNumbers.slice(-10).reverse().map((number, index) => (
                    <div 
                      key={`recent-${index}`}
                      className="bg-gray-100 rounded-full h-8 w-8 flex items-center justify-center text-sm font-medium"
                    >
                      {number}
                    </div>
                  ))}
                </div>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Current Number */}
            <SidebarGroup>
              <SidebarGroupContent className="flex flex-col items-center">
                <CurrentNumberDisplay 
                  number={currentNumber}
                  sizePx={120}
                  className="mb-4"
                />
                
                {/* Bingo Claim Button */}
                <div className="w-full max-w-xs mb-4">
                  <BingoClaim
                    onClaimBingo={onClaimBingo}
                    claimStatus={claimStatus}
                    isClaiming={isClaiming}
                    resetClaimStatus={() => {}}
                  />
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1">
          <div className="w-full bg-white shadow-sm py-4">
            <div className="container mx-auto px-4">
              <GameHeader 
                gameType={gameType} 
                playerName={playerName} 
                playerCode={playerCode}
                currentGameNumber={currentGameNumber}
                numberOfGames={numberOfGames}
              />
            </div>
          </div>
          
          <div className="container mx-auto px-4 py-8">
            {/* Only show error message if it's not a connection-related error and we have a real error */}
            {errorMessage && !errorMessage.toLowerCase().includes('connection') && 
             !errorMessage.toLowerCase().includes('player code is required') && (
              <div className="bg-red-50 p-4 rounded-md text-red-800 mb-6">
                <p className="font-medium">Error: {errorMessage}</p>
                <p className="text-sm mt-1">Please try refreshing the page or re-join using your player code.</p>
              </div>
            )}
            
            {/* Auto marking toggle */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Auto Marking</h3>
                <p className="text-sm text-gray-500">Automatically mark numbers on your tickets</p>
              </div>
              <div className="flex items-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={autoMarking}
                    onChange={(e) => {
                      setAutoMarking(e.target.checked);
                      localStorage.setItem('autoMarking', e.target.checked.toString());
                    }}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
            
            {/* Game content */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
