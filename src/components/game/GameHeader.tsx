
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Settings, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface GameHeaderProps {
  sessionName?: string;
  accessCode?: string;
  activeWinPattern?: string;
  autoMarking?: boolean;
  setAutoMarking?: (value: boolean) => void;
  isConnected?: boolean;
  connectionState?: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export default function GameHeader({
  sessionName = "Bingo Game",
  accessCode,
  activeWinPattern,
  autoMarking,
  setAutoMarking,
  isConnected = true,
  connectionState = 'connected'
}: GameHeaderProps) {
  const navigate = useNavigate();

  const handleAutoMarkingToggle = () => {
    if (setAutoMarking) {
      setAutoMarking(!autoMarking);
    }
  };

  const getPatternDisplayName = (pattern?: string): string => {
    if (!pattern) return "Full House";
    if (pattern === "oneLine") return "One Line";
    if (pattern === "twoLines") return "Two Lines";
    if (pattern === "fullHouse") return "Full House";
    return pattern;
  };

  const handleExitGame = () => {
    // Clear player data from localStorage
    localStorage.removeItem('playerCode');
    // Navigate to join page
    navigate('/player/join');
  };

  return (
    <header className="px-4 py-3 flex items-center justify-between">
      <div className="flex items-center">
        <h1 className="font-bold text-lg mr-2">
          {sessionName}
        </h1>
        {activeWinPattern && (
          <Badge variant="secondary" className="hidden sm:flex">
            {getPatternDisplayName(activeWinPattern)}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        {connectionState && (
          <div className="flex items-center text-sm">
            {connectionState === 'connected' ? (
              <Wifi className="h-4 w-4 text-green-500 mr-1" />
            ) : connectionState === 'connecting' ? (
              <Wifi className="h-4 w-4 text-amber-500 mr-1" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500 mr-1" />
            )}
            <span className="hidden sm:inline text-gray-600">
              {connectionState === 'connected' ? 'Connected' : 
              connectionState === 'connecting' ? 'Connecting...' : 
              connectionState === 'error' ? 'Error' : 'Offline'}
            </span>
          </div>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-500 hover:text-gray-700"
          onClick={handleExitGame}
        >
          Exit
        </Button>
      </div>
    </header>
  );
}
