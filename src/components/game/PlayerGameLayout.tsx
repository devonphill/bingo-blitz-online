
import React, { useState } from "react";
import { PlayerGameContent } from "./PlayerGameContent";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  autoMarking: boolean;
  setAutoMarking: (value: boolean) => void;
  playerCode: string;
  onReconnect: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  autoMarking,
  setAutoMarking,
  playerCode,
  onReconnect
}) => {
  return (
    <div
      className={`fixed inset-y-0 left-0 w-64 bg-gray-800 text-white transform transition duration-200 ease-in-out ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } z-50`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Game Options</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-6 w-6" />
          </Button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span>Auto Marking:</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                value=""
                className="sr-only peer"
                checked={autoMarking}
                onChange={(e) => setAutoMarking(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-500"></div>
              <span className="ml-3 text-sm font-medium text-gray-300">
                {autoMarking ? "On" : "Off"}
              </span>
            </label>
          </div>
          <div>
            <Button variant="secondary" className="w-full" onClick={onReconnect}>
              Reconnect
            </Button>
          </div>
          <div>
            <p>Player Code: {playerCode}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PlayerGameLayoutProps {
  tickets: any[];
  calledNumbers: number[];
  currentNumber: number;
  currentSession: any;
  autoMarking: boolean;
  setAutoMarking: (value: boolean) => void;
  playerCode: string;
  showLobby?: boolean;
  lobbyComponent?: React.ReactNode;
  playerName?: string;
  claimCount?: number;
  winPatterns?: any[];
  isClaimable?: boolean;
  onClaimWin: () => void;
  sessionId?: string | null;
  onReconnect: () => void;
}

export default function PlayerGameLayout({
  tickets,
  calledNumbers,
  currentNumber,
  currentSession,
  autoMarking,
  setAutoMarking,
  playerCode,
  showLobby = false,
  lobbyComponent,
  playerName,
  claimCount = 0,
  winPatterns = [],
  isClaimable = false,
  onClaimWin,
  sessionId,
  onReconnect,
}: PlayerGameLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Define a simple refresh tickets function that can be passed to PlayerGameContent
  const handleRefreshTickets = () => {
    console.log("Refreshing tickets...");
    // In a real implementation, this would trigger a fetch of updated tickets
  };

  return (
    <div className="flex h-full overflow-hidden relative bg-gradient-to-b from-bingo-background to-bingo-background-alt">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={toggleSidebar}
        autoMarking={autoMarking}
        setAutoMarking={setAutoMarking}
        playerCode={playerCode}
        onReconnect={onReconnect}
      />

      {/* Menu Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={toggleSidebar}
        className="absolute top-4 left-4 md:hidden z-50"
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 pt-20 md:p-6 md:pt-20">
        <div className="container mx-auto max-w-5xl pb-20">
          {showLobby ? (
            lobbyComponent
          ) : (
            <PlayerGameContent
              tickets={tickets}
              calledNumbers={calledNumbers}
              currentNumber={currentNumber}
              currentSession={currentSession}
              autoMarking={autoMarking}
              setAutoMarking={setAutoMarking}
              playerCode={playerCode}
              showLobby={showLobby}
              lobbyComponent={lobbyComponent}
              playerName={playerName}
              claimCount={claimCount}
              winPatterns={winPatterns}
              isClaimable={isClaimable}
              onClaimWin={onClaimWin}
              sessionId={sessionId}
              onReconnect={onReconnect}
              onRefreshTickets={handleRefreshTickets} // Add the missing prop here
            />
          )}
        </div>
      </div>

      {/* Fixed Footer (example) */}
      {/*<div className="absolute bottom-0 left-0 w-full bg-gray-900 text-white text-center p-4">
        Footer Content
      </div>*/}
    </div>
  );
}
