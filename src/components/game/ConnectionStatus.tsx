
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { usePlayerWebSocketNumbers } from '@/hooks/playerWebSocket/usePlayerWebSocketNumbers';
import { formatDistanceToNow } from 'date-fns';

interface ConnectionStatusProps {
  sessionId: string;
  onReconnect: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ sessionId, onReconnect }) => {
  const { isConnected, connectionState, lastUpdateTime } = usePlayerWebSocketNumbers(sessionId);
  
  // Format the last update time
  const formattedLastUpdate = React.useMemo(() => {
    if (!lastUpdateTime) return 'Never';
    return formatDistanceToNow(lastUpdateTime, { addSuffix: true });
  }, [lastUpdateTime]);
  
  // Determine connection status color and message
  const getConnectionStatus = () => {
    if (isConnected) {
      return {
        color: 'bg-green-500',
        icon: <Wifi className="h-4 w-4 mr-1" />,
        text: 'Connected'
      };
    } else if (connectionState === 'connecting') {
      return {
        color: 'bg-amber-500',
        icon: <RefreshCw className="h-4 w-4 mr-1 animate-spin" />,
        text: 'Connecting...'
      };
    } else {
      return {
        color: 'bg-red-500',
        icon: <WifiOff className="h-4 w-4 mr-1" />,
        text: 'Disconnected'
      };
    }
  };
  
  const connectionStatus = getConnectionStatus();

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Connection Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Status:</span>
          <Badge className={`${connectionStatus.color} flex items-center`}>
            {connectionStatus.icon} {connectionStatus.text}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Last Update:</span>
          <span className="text-sm font-medium">{formattedLastUpdate}</span>
        </div>
        
        {!isConnected && (
          <div className="pt-1">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full flex items-center justify-center text-xs"
              onClick={onReconnect}
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Reconnect
            </Button>
            <p className="text-xs text-gray-500 mt-1">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              If you're not seeing number updates, try reconnecting
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConnectionStatus;
