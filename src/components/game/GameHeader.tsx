
import React from "react";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Wifi, WifiOff } from 'lucide-react';

interface GameHeaderProps {
  sessionName: string;
  accessCode: string;
  activeWinPattern?: string | null;
  autoMarking: boolean;
  setAutoMarking: (value: boolean) => void;
  isConnected?: boolean;
  connectionState?: 'connected' | 'connecting' | 'disconnected';
}

export default function GameHeader({
  sessionName,
  accessCode,
  activeWinPattern,
  autoMarking,
  setAutoMarking,
  isConnected = true,
  connectionState = 'connected'
}: GameHeaderProps) {
  return (
    <div className="p-4 flex justify-between items-center">
      <div>
        <h1 className="text-xl font-bold mb-1">{sessionName}</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Code: {accessCode}</span>
          {connectionState === 'connected' || isConnected ? (
            <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600">
              <Wifi className="h-3 w-3" /> Connected
            </Badge>
          ) : connectionState === 'connecting' ? (
            <Badge variant="outline" className="flex items-center gap-1 text-amber-600 border-amber-600">
              <Wifi className="h-3 w-3" /> Connecting...
            </Badge>
          ) : (
            <Badge variant="outline" className="flex items-center gap-1 text-red-600 border-red-600">
              <WifiOff className="h-3 w-3" /> Offline
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end">
        {activeWinPattern && (
          <Badge className="mb-2">{activeWinPattern}</Badge>
        )}
        <div className="flex items-center space-x-2">
          <Switch
            id="auto-marking"
            checked={autoMarking}
            onCheckedChange={setAutoMarking}
          />
          <Label htmlFor="auto-marking">Auto Mark</Label>
        </div>
      </div>
    </div>
  );
}
