
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Signal, Info } from 'lucide-react';
import { connectionManager } from '@/utils/connectionManager';
import { useNetwork } from '@/contexts/NetworkStatusContext';

export interface DebugPanelProps {
  playerCode?: string | null;
  sessionId?: string | null;
  gameType?: string;
  onReconnect?: () => void;
  calledNumbers?: number[];
  lastCalledNumber?: number | null;
  connectionState?: string;
}

export default function DebugPanel({
  playerCode,
  sessionId,
  gameType = 'unknown',
  onReconnect,
  calledNumbers = [],
  lastCalledNumber,
  connectionState = 'disconnected'
}: DebugPanelProps) {
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('Never');
  const [refreshTime, setRefreshTime] = useState<number>(0);
  
  // Use the network context
  const network = useNetwork();
  
  // Periodically update the last update time
  useEffect(() => {
    const timer = setInterval(() => {
      // Use connectionManager or network state to determine connection state
      const connectionIsActive = network.isConnected || connectionManager.isConnected();
      const pingTime = connectionManager.getLastPing();
      
      if (pingTime) {
        const now = Date.now();
        const diff = Math.floor((now - pingTime) / 1000);
        
        if (diff > 300) {
          setLastUpdateTime(`${Math.floor(diff / 60)} min ago`);
        } else {
          setLastUpdateTime(`${diff} sec ago`);
        }
      } else {
        setLastUpdateTime('Never');
      }
      
      setRefreshTime(prev => prev + 1);
    }, 1000);
    
    return () => {
      clearInterval(timer);
    };
  }, [network]);
  
  // Determine connection status badge color
  const getStatusColor = () => {
    const effectiveState = network.connectionState || connectionState;
    
    if (effectiveState === 'connected') return 'bg-green-500 text-white';
    if (effectiveState === 'connecting') return 'bg-orange-500 text-white';
    if (effectiveState === 'error') return 'bg-red-500 text-white';
    return 'bg-gray-500 text-white';
  };

  return (
    <div className="bg-bingo-muted/10 border rounded-md p-2 text-xs space-y-2 shadow-sm">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold flex items-center">
          <Info className="h-3 w-3 mr-1" /> Debug Info
        </h3>
        <Badge className={getStatusColor()}>
          <Signal className="h-3 w-3 mr-1" />
          {network.connectionState || connectionState}
        </Badge>
      </div>
      
      <Separator className="my-1" />
      
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Player Code:</span>
          <span className="font-mono">{playerCode || 'None'}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Session:</span>
          <span className="font-mono">{sessionId ? sessionId.substring(0, 8) + '...' : 'None'}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Game Type:</span>
          <span>{gameType || 'unknown'}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Last Update:</span>
          <span>{lastUpdateTime}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Numbers Called:</span>
          <span>{calledNumbers?.length || 0}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Last Called:</span>
          <span className="font-bold">{lastCalledNumber || 'None'}</span>
        </div>
      </div>
      
      {onReconnect && (
        <Button 
          size="sm" 
          variant="secondary" 
          className="w-full mt-2 h-7 text-xs"
          onClick={onReconnect}
        >
          <RefreshCw className="h-3 w-3 mr-1" /> Reconnect
        </Button>
      )}
    </div>
  );
}
