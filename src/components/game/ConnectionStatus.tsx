
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, AlertCircle, CheckCircle, WifiOff } from 'lucide-react';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';

interface ConnectionStatusProps {
  sessionId?: string;
  onReconnect?: () => void;
  className?: string;
}

export default function ConnectionStatus({ 
  sessionId, 
  onReconnect,
  className = ""
}: ConnectionStatusProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [lastPingTime, setLastPingTime] = useState<Date | null>(null);
  const [pingAge, setPingAge] = useState<string>('N/A');
  
  // Update ping age in real-time
  useEffect(() => {
    const interval = setInterval(() => {
      const connection = getSingleSourceConnection();
      const lastPing = connection.getLastPing();
      
      setLastPingTime(lastPing);
      
      if (lastPing) {
        const now = new Date();
        const diffSeconds = Math.floor((now.getTime() - lastPing.getTime()) / 1000);
        
        if (diffSeconds < 60) {
          setPingAge(`${diffSeconds}s ago`);
        } else if (diffSeconds < 3600) {
          setPingAge(`${Math.floor(diffSeconds / 60)}m ago`);
        } else {
          setPingAge(`${Math.floor(diffSeconds / 3600)}h ago`);
        }
      } else {
        setPingAge('N/A');
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Set up connection listener
  useEffect(() => {
    const connection = getSingleSourceConnection();
    
    const cleanup = connection.addConnectionListener((connected, state) => {
      setIsConnected(connected);
      setConnectionState(state);
    });
    
    return cleanup;
  }, []);
  
  // Handle reconnection
  const handleReconnect = () => {
    if (onReconnect) {
      onReconnect();
    } else if (sessionId) {
      const connection = getSingleSourceConnection();
      connection.connect(sessionId);
    }
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {isConnected ? (
        <>
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-xs text-green-600">Connected</span>
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] ml-1">
            <Activity className="h-3 w-3 mr-1" />
            {pingAge}
          </Badge>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-red-500" />
          <span className="text-xs text-red-600">Disconnected ({connectionState})</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 py-0 text-xs ml-1"
            onClick={handleReconnect}
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            Reconnect
          </Button>
        </>
      )}
    </div>
  );
}
