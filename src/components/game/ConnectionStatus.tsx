
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { logWithTimestamp } from '@/utils/logUtils';
import { webSocketService, CHANNEL_NAMES, WEBSOCKET_STATUS } from '@/services/websocket';
import { toast } from '@/hooks/use-toast';

interface ConnectionStatusProps {
  showFull?: boolean;
  className?: string;
  onReconnect?: () => void;
  sessionId?: string | null;
}

export default function ConnectionStatus({ 
  showFull = false,
  className = '',
  onReconnect,
  sessionId
}: ConnectionStatusProps) {
  const [expanded, setExpanded] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('unknown');
  const [lastPingTime, setLastPingTime] = useState<number>(Date.now());
  const instanceId = useRef(`conn-${Math.random().toString(36).substring(2, 7)}`);
  
  // Update connection state from WebSocketService
  useEffect(() => {
    if (!sessionId) {
      setConnectionState('disconnected');
      return;
    }
    
    // Get initial state
    setConnectionState(webSocketService.getConnectionState(CHANNEL_NAMES.GAME_UPDATES));
    
    // Set up subscription to connection status
    const statusListener = (status: string) => {
      setConnectionState(status);
      setLastPingTime(Date.now());
    };
    
    // Add status listener
    webSocketService.subscribeWithReconnect(CHANNEL_NAMES.GAME_UPDATES, statusListener);
    
    // Return cleanup function
    return () => {
      // There's no direct way to remove a specific listener in the current implementation
    };
  }, [sessionId]);
  
  // Periodically update ping time
  useEffect(() => {
    const interval = setInterval(() => {
      setLastPingTime(Date.now());
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  const getStatusColor = useCallback(() => {
    if (isReconnecting) return 'bg-amber-500 animate-pulse';
    
    switch (connectionState) {
      case WEBSOCKET_STATUS.SUBSCRIBED: return 'bg-green-500';
      case 'connecting': 
      case 'CONNECTING': 
      case 'JOINING': return 'bg-amber-500';
      case WEBSOCKET_STATUS.CLOSED: 
      case 'disconnected': return 'bg-red-500';
      case WEBSOCKET_STATUS.CHANNEL_ERROR: 
      case 'error': return 'bg-red-700';
      default: return 'bg-gray-500';
    }
  }, [connectionState, isReconnecting]);
  
  const getStatusText = useCallback(() => {
    if (isReconnecting) return 'Reconnecting...';
    
    switch (connectionState) {
      case WEBSOCKET_STATUS.SUBSCRIBED: return 'Connected';
      case 'connecting': 
      case 'CONNECTING': 
      case 'JOINING': return 'Connecting...';
      case WEBSOCKET_STATUS.CLOSED: 
      case 'disconnected': return 'Disconnected';
      case WEBSOCKET_STATUS.CHANNEL_ERROR: 
      case 'error': return 'Connection Error';
      default: return 'Unknown';
    }
  }, [connectionState, isReconnecting]);
  
  const getStatusIcon = useCallback(() => {
    if (isReconnecting) return <RefreshCw className="h-4 w-4 animate-spin" />;
    
    const isConnected = connectionState === WEBSOCKET_STATUS.SUBSCRIBED;
    
    return isConnected 
      ? <Wifi className="h-4 w-4" /> 
      : <WifiOff className="h-4 w-4" />;
  }, [connectionState, isReconnecting]);
  
  const handleReconnectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsReconnecting(true);
    logWithTimestamp(`[${instanceId.current}] User requested manual reconnection`, 'info');
    
    // Force reconnect via WebSocketService
    webSocketService.reconnectChannel(CHANNEL_NAMES.GAME_UPDATES);
    
    // Also call the provided reconnect callback if any
    if (onReconnect) {
      onReconnect();
    }
    
    // Show toast
    toast({
      title: "Reconnecting",
      description: "Attempting to reconnect to the game server...",
      duration: 3000
    });
    
    // Reset reconnecting UI after a delay
    setTimeout(() => setIsReconnecting(false), 3000);
  };
  
  return (
    <div className={`relative ${className}`}>
      <div 
        className={`flex items-center cursor-pointer ${showFull ? 'p-2 rounded border' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-3 h-3 rounded-full ${getStatusColor()} mr-2`} />
        {showFull && (
          <span className="text-sm font-medium flex items-center gap-1">
            {getStatusIcon()}
            {getStatusText()}
          </span>
        )}
        
        {(connectionState === WEBSOCKET_STATUS.CLOSED || 
          connectionState === WEBSOCKET_STATUS.CHANNEL_ERROR || 
          connectionState === 'disconnected' || 
          connectionState === 'error') && (
          <button 
            className="ml-2 text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded flex items-center gap-1"
            onClick={handleReconnectClick}
            disabled={isReconnecting}
          >
            <RefreshCw className={`h-3 w-3 ${isReconnecting ? 'animate-spin' : ''}`} />
            {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
          </button>
        )}
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full right-0 mt-2 bg-white shadow-lg rounded-md p-3 z-50 w-80"
          >
            <h4 className="font-bold mb-2">Connection Details</h4>
            <div className="text-xs space-y-1">
              <div>Status: <span className="font-semibold">{getStatusText()}</span></div>
              <div>Channel: <span className="font-mono">{CHANNEL_NAMES.GAME_UPDATES}</span></div>
              <div>Session ID: <span className="font-mono">{sessionId || 'Not connected'}</span></div>
              <div>Last Check: <span className="font-mono">{new Date(lastPingTime).toLocaleTimeString()}</span></div>
              
              <div className="pt-2">
                <button 
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs flex items-center justify-center gap-1"
                  onClick={handleReconnectClick}
                  disabled={isReconnecting || !sessionId}
                >
                  <RefreshCw className={`h-3 w-3 ${isReconnecting ? 'animate-spin' : ''}`} />
                  {isReconnecting ? 'Reconnecting...' : 'Force Reconnect'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
