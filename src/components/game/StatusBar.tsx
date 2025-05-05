
import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';

interface StatusBarProps {
  playerName?: string | null;
  currentNumber?: number | null;
  calledNumbers?: number[];
  gameType?: string;
  showAutoMarkToggle?: boolean;
  autoMarkEnabled?: boolean;
  onToggleAutoMark?: () => void;
  connectionState?: string;
}

export default function StatusBar({
  playerName,
  currentNumber,
  calledNumbers = [],
  gameType = 'mainstage',
  showAutoMarkToggle = true,
  autoMarkEnabled = true,
  onToggleAutoMark,
  connectionState = 'connected'
}: StatusBarProps) {
  
  return (
    <Card className="p-4 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="flex items-center space-x-4">
          {playerName && (
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">Playing as</span>
              <span className="font-semibold">{playerName}</span>
            </div>
          )}
          
          <div className="flex flex-col">
            <span className="text-xs text-gray-500">Last Called</span>
            <span className="font-bold text-xl md:text-2xl text-bingo-primary">
              {currentNumber || '-'}
            </span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-xs text-gray-500">Called</span>
            <span className="font-semibold">{calledNumbers.length || 0} numbers</span>
          </div>
          
          <Badge variant="outline" className="hidden md:flex">
            {gameType === 'mainstage' ? '90-Ball' : '75-Ball'}
          </Badge>
          
          {connectionState && (
            <Badge 
              variant={connectionState === 'connected' ? 'default' : 'outline'} 
              className={`hidden md:flex ${connectionState !== 'connected' ? 'text-amber-500 border-amber-500' : ''}`}
            >
              {connectionState === 'connected' ? (
                <Wifi className="h-3 w-3 mr-1" />
              ) : (
                <WifiOff className="h-3 w-3 mr-1" />
              )}
              {connectionState}
            </Badge>
          )}
        </div>
        
        {showAutoMarkToggle && (
          <div className="flex items-center space-x-2">
            <Switch 
              id="auto-mark" 
              checked={autoMarkEnabled}
              onCheckedChange={onToggleAutoMark}
            />
            <Label htmlFor="auto-mark">Auto Mark Numbers</Label>
          </div>
        )}
      </div>
    </Card>
  );
}
