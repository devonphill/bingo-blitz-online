
import React from "react";
import CurrentNumberDisplay from "@/components/game/CurrentNumberDisplay";
import CalledNumbers from "@/components/game/CalledNumbers";
import PlayerTicketsPanel from "@/components/game/PlayerTicketsPanel";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

// Props for layout, kept minimal for panel orchestration
export default function PlayerGameLayout({
  tickets,
  calledNumbers,
  currentNumber,
  currentSession,
  autoMarking,
  setAutoMarking,
  playerCode,
  winPrizes,
  activeWinPatterns,
  onClaimBingo,
  errorMessage,
  isLoading,
}: any) {
  // Loading and error states
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading game...</h2>
        </div>
      </div>
    );
  }
  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white shadow-lg rounded-lg p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
          <p className="text-gray-700 mb-6">{errorMessage}</p>
          <div className="flex justify-center">
            <Button onClick={() => window.location.href = '/join'}>
              Join a Different Game
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (!currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Waiting for game to start</h2>
          <p className="text-gray-600 mb-4">The caller has not started the game yet.</p>
          <Button onClick={() => window.location.href = '/join'}>
            Join a Different Game
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen w-full flex bg-gray-50">
      {/* Side Panels */}
      <div className="flex flex-col" style={{width:'30%', minWidth:240, maxWidth:400}}>
        {/* Black background top area */}
        <div className="flex-1 bg-black text-white p-4">
          <div className="flex flex-col gap-2 mb-4">
            <h1 className="text-xl font-bold">Bingo Game Info</h1>
            {activeWinPatterns.length > 0 && (
              <div>
                <span className="text-xs text-gray-300 font-medium">
                  Win Pattern: {activeWinPatterns.map((key: string) => 
                    <span key={key} className="inline-block mr-2 px-2 py-1 bg-gray-800 rounded text-white">
                      {key}{winPrizes[key] ? `: ${winPrizes[key]}` : ""}
                    </span>
                  )}
                </span>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Switch id="auto-marking" checked={autoMarking} onCheckedChange={setAutoMarking} />
              <label htmlFor="auto-marking" className="text-sm font-medium">Auto Marking</label>
            </div>
          </div>
        </div>
        {/* Current Number Visual at bottom left corner, square panel */}
        <div className="flex items-center justify-center p-4 bg-gray-900">
          <CurrentNumberDisplay 
            number={currentNumber} 
            sizePx={Math.min(window.innerWidth * 0.3 * 0.8, 180)} 
          />
        </div>
      </div>
      {/* Main display area */}
      <div className="flex-1 bg-gray-50 h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-6">
          <Button
            className="w-full mb-4 bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary"
            onClick={onClaimBingo}
          >
            Claim Bingo!
          </Button>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PlayerTicketsPanel 
              tickets={tickets}
              calledNumbers={calledNumbers}
              autoMarking={autoMarking}
              activeWinPatterns={activeWinPatterns}
            />
            <div>
              <div className="bg-white shadow rounded-lg p-6">
                <CalledNumbers calledNumbers={calledNumbers} currentNumber={currentNumber} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
