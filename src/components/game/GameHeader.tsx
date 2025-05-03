
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GameHeaderProps {
  sessionName?: string;
  accessCode?: string;
  activeWinPattern?: string | null;
  autoMarking: boolean;
  setAutoMarking: (value: boolean) => void;
  isConnected?: boolean;
  connectionState?: 'disconnected' | 'connecting' | 'connected' | 'error';
  onReconnect?: () => void;
}

export default function GameHeader({
  sessionName = "Bingo Game",
  accessCode,
  activeWinPattern,
  autoMarking,
  setAutoMarking,
  isConnected = false,
  connectionState = 'disconnected',
  onReconnect
}: GameHeaderProps) {
  const handleAutoMarkingToggle = (checked: boolean) => {
    setAutoMarking(checked);
  };

  // Get connection display settings
  const getConnectionInfo = () => {
    switch (connectionState) {
      case 'connected':
        return { color: "bg-green-500", text: "Connected" };
      case 'connecting':
        return { color: "bg-yellow-500", text: "Connecting..." };
      case 'error':
        return { color: "bg-red-500", text: "Connection Error" };
      case 'disconnected':
      default:
        return { color: "bg-gray-500", text: "Disconnected" };
    }
  };
  
  const connectionInfo = getConnectionInfo();

  return (
    <header className="py-2 px-4">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-bold truncate">{sessionName}</h1>
          {accessCode && (
            <Badge variant="outline" className="text-xs">
              Code: {accessCode}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden md:flex items-center">
            {activeWinPattern && (
              <Badge variant="secondary" className="text-xs">
                Win Pattern: {activeWinPattern}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center space-x-1">
              <Switch
                id="auto-marking"
                checked={autoMarking}
                onCheckedChange={handleAutoMarkingToggle}
              />
              <Label htmlFor="auto-marking" className="text-xs">Auto Mark</Label>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${connectionInfo.color}`}></div>
              <span className="text-xs hidden sm:inline">{connectionInfo.text}</span>
              
              {onReconnect && (connectionState !== 'connected') && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0" 
                  onClick={onReconnect}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
