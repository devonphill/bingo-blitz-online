
import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import CurrentNumberDisplay from './CurrentNumberDisplay';

interface StatusBarProps {
  playerName?: string;
  currentNumber?: number | null;
  calledNumbers?: number[];
  gameType?: string;
  showAutoMarkToggle?: boolean;
  autoMarkEnabled?: boolean;
  onToggleAutoMark?: () => void;
  connectionState?: 'disconnected' | 'connecting' | 'connected' | 'error';
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
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          {playerName && (
            <div>
              <div className="text-xs text-gray-500">Player</div>
              <div className="font-semibold">{playerName}</div>
            </div>
          )}
          
          <div>
            <div className="text-xs text-gray-500">Game Type</div>
            <div className="font-semibold">
              {gameType === 'mainstage' ? '90-Ball' : 
               gameType === 'seventyfive' ? '75-Ball' : 
               gameType}
            </div>
          </div>
          
          <div>
            <div className="text-xs text-gray-500">Called Numbers</div>
            <div className="font-semibold">{calledNumbers.length}</div>
          </div>
          
          <div className={`flex items-center gap-1 ${
            connectionState === 'connected' ? 'text-green-600' :
            connectionState === 'connecting' ? 'text-blue-600' :
            'text-red-600'
          }`}>
            <div className={`h-2 w-2 rounded-full ${
              connectionState === 'connected' ? 'bg-green-500' :
              connectionState === 'connecting' ? 'bg-blue-500' :
              'bg-red-500'
            }`}></div>
            <span className="text-xs">
              {connectionState === 'connected' ? 'Connected' :
               connectionState === 'connecting' ? 'Connecting...' :
               'Disconnected'}
            </span>
          </div>
        </div>
        
        {currentNumber !== null && (
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500">Last Called:</div>
            <CurrentNumberDisplay 
              number={currentNumber} 
              sizePx={44}
            />
          </div>
        )}
        
        {showAutoMarkToggle && (
          <div className="flex items-center space-x-2">
            <Label htmlFor="auto-mark" className="text-sm text-gray-600">Auto Mark</Label>
            <Switch
              id="auto-mark"
              checked={autoMarkEnabled}
              onCheckedChange={onToggleAutoMark}
            />
          </div>
        )}
      </div>
    </div>
  );
}
