import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getNCMInstance } from '@/utils/NEWConnectionManager_SinglePointOfTruth';

interface DebugPanelProps {
  sessionId: string;
}

export default function DebugPanel({ sessionId }: DebugPanelProps) {
  const [connectionStatus, setConnectionStatus] = useState<string>('unknown');
  const [lastPingTime, setLastPingTime] = useState<Date | null>(null);
  const [pingTimeDisplay, setPingTimeDisplay] = useState<string>('N/A');
  
  // Update connection status and ping time
  useEffect(() => {
    const connection = getNCMInstance();
    
    // Set up status listener
    const cleanup = connection.addStatusListener((status) => {
      setConnectionStatus(status);
    });
    
    // Update ping display
    const interval = setInterval(() => {
      const pingTime = connection.getLastPing();
      
      // Handle different types of pingTime
      if (pingTime instanceof Date) {
        setLastPingTime(pingTime);
        setPingTimeDisplay(pingTime.toLocaleTimeString());
      } else if (typeof pingTime === 'number') {
        // If pingTime is a timestamp number, convert to Date first
        const pingDate = new Date(pingTime);
        setLastPingTime(pingDate);
        setPingTimeDisplay(pingDate.toLocaleString());
      } else if (pingTime) {
        // Handle any other non-null value
        setPingTimeDisplay(String(pingTime));
      }
    }, 1000);
    
    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, []);
  
  return (
    <Card className="w-full">
      <CardHeader className="py-2 px-4">
        <CardTitle className="text-xs">Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Session:</span>
            <span className="font-mono">{sessionId.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between">
            <span>Status:</span>
            <Badge variant={connectionStatus === 'connected' ? 'default' : 'outline'} 
                   className={connectionStatus === 'connected' ? "bg-green-500 hover:bg-green-600" : ""}>
              {connectionStatus}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span>Last Ping:</span>
            <span>{pingTimeDisplay}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
