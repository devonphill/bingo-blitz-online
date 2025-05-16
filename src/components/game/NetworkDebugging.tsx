
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNetworkContext } from '@/contexts/network';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';

interface NetworkDebuggingProps {
  sessionId: string;
}

export default function NetworkDebugging({ sessionId }: NetworkDebuggingProps) {
  const network = useNetworkContext();
  const connection = getSingleSourceConnection();

  const handleReconnect = () => {
    if (!sessionId) return;
    connection.connect(sessionId);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm">Network Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span>Connection:</span>
          <Badge variant={network.isConnected ? "default" : "destructive"} 
                 className={network.isConnected ? "bg-green-500 hover:bg-green-600" : ""}>
            {network.isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span>Session ID:</span>
          <span className="text-xs font-mono">{sessionId || 'None'}</span>
        </div>
        <div className="mt-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleReconnect} 
            className="w-full text-xs"
          >
            Reconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
