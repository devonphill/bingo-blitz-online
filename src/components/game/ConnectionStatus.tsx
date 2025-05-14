
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { logWithTimestamp } from '@/utils/logUtils';
import { getWebSocketService, CHANNEL_NAMES, WEBSOCKET_STATUS } from '@/services/websocket';
import { useToast } from '@/hooks/use-toast';

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
  const webSocketService = useRef(getWebSocketService());
  const { toast } = useToast();
  
  // Update connection state periodically
  useEffect(() => {
    if (!sessionId) return;
    
    // Check connection state immediately
    const state = webSocketService.current.getConnectionState(CHANNEL_NAMES.GAME_UPDATES);
    setConnectionState(state);
    
    // Setup channel if not already done
    webSocketService.current.createChannel(CHANNEL_NAMES.GAME_UPDATES);
    
    // Setup subscription with reconnect capability
    const cleanup = webSocketService.current.subscribeWithReconnect(
      CHANNEL_NAMES.GAME_UPDATES,
      (status) => {
        setConnectionState(status);
        if (status === WEBSOCKET_STATUS.SUBSCRIBED) {
          setLastPingTime(Date.now());
        }
      }
    );
    
    // Check connection state on interval
    const interval = setInterval(() => {
      const currentState = webSocketService.current.getConnectionState(CHANNEL_NAMES.GAME_UPDATES);
      setConnectionState(currentState);
    }, 5000);
    
    return () => {
      clearInterval(interval);
      cleanup();
    };
  }, [sessionId]);
  
  // Calculate time since last ping
  const timeSinceLastPing = Date.now() - lastPingTime;
  const isStale = timeSinceLastPing > 60000; // 60 seconds
  
  // Handle manual reconnect
  const handleReconnect = useCallback(() => {
    if (!sessionId) return;
    
    setIsReconnecting(true);
    
    try {
      // Tell WebSocketService to reconnect the channel
      webSocketService.current.reconnectChannel(CHANNEL_NAMES.GAME_UPDATES);
      
      // Call parent reconnect if provided
      if (onReconnect) {
        onReconnect();
      }
      
      toast({
        title: 'Reconnecting...',
        description: 'Attempting to restore connection',
      });
      
      setTimeout(() => {
        setIsReconnecting(false);
      }, 2000);
    } catch (error) {
      console.error('Error during reconnect:', error);
      setIsReconnecting(false);
    }
  }, [sessionId, onReconnect, toast]);
  
  // Only show connection issues after we know we're not connected
  const isConnected = connectionState === WEBSOCKET_STATUS.SUBSCRIBED;
  
  // Derived status text
  const statusText = isConnected 
    ? 'Connected' 
    : connectionState === 'CHANNEL_ERROR'
      ? 'Connection Error'
      : connectionState === 'TIMED_OUT'
        ? 'Connection Timed Out'
        : 'Disconnected';
  
  // Visual presentation based on connection state and component settings  
  return (
    <div className={`relative ${className}`}>
      <motion.button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center px-2 py-1 rounded ${
          isConnected ? 'text-green-500' : 'text-red-500'
        }`}
        whileHover={{ scale: 1.05 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {isConnected ? (
          <Wifi className="w-5 h-5" />
        ) : (
          <WifiOff className="w-5 h-5" />
        )}
        
        {(showFull || expanded) && (
          <span className="ml-2 text-sm">{statusText}</span>
        )}
      </motion.button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-2 right-0 bg-white shadow-md rounded-md p-3 w-52 z-50"
          >
            <div className="text-sm font-medium mb-2">Connection Status</div>
            <div className="text-xs text-gray-600 mb-3">
              <div className="mb-1">Status: 
                <span className={isConnected ? 'text-green-500 ml-1' : 'text-red-500 ml-1'}>
                  {statusText}
                </span>
              </div>
              <div className="mb-1">
                Last Update: {new Date(lastPingTime).toLocaleTimeString()}
                {isStale && !isConnected && (
                  <span className="text-amber-500 ml-1">(stale)</span>
                )}
              </div>
            </div>
            
            <button
              onClick={handleReconnect}
              disabled={isReconnecting}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded flex items-center justify-center"
            >
              {isReconnecting ? (
                <span>Reconnecting...</span>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Reconnect
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
