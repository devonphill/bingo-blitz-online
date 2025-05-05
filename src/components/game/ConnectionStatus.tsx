
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { logWithTimestamp } from '@/utils/logUtils';
import { useNetwork, ConnectionState } from '@/contexts/NetworkStatusContext';

interface ConnectionStatusProps {
  showFull?: boolean;
  className?: string;
}

export default function ConnectionStatus({ 
  showFull = false,
  className = ''
}: ConnectionStatusProps) {
  const [expanded, setExpanded] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // Use the network context
  const network = useNetwork();
  const { connectionState, isConnected, lastPingTime, reconnect, sessionId } = network;
  
  const getStatusColor = useCallback(() => {
    if (isReconnecting) return 'bg-amber-500 animate-pulse';
    
    switch (connectionState) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-amber-500';
      case 'disconnected': return 'bg-red-500';
      case 'error': return 'bg-red-700';
      default: return 'bg-gray-500';
    }
  }, [connectionState, isReconnecting]);
  
  const getStatusText = useCallback(() => {
    if (isReconnecting) return 'Reconnecting...';
    
    switch (connectionState) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Connection Error';
      default: return 'Unknown';
    }
  }, [connectionState, isReconnecting]);
  
  const handleReconnectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsReconnecting(true);
    logWithTimestamp('User requested manual reconnection', 'info');
    
    // Use the network context to reconnect
    reconnect();
    
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
          <span className="text-sm font-medium">{getStatusText()}</span>
        )}
        
        {(connectionState === 'disconnected' || connectionState === 'error') && (
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
              
              {/* Enhanced status details */}
              <div>Session ID: <span className="font-mono">{sessionId || 'Not connected'}</span></div>
              {lastPingTime !== null && (
                <div>
                  Last ping: <span className="font-mono">{Date.now() - lastPingTime}ms ago</span>
                </div>
              )}
              
              <div className="pt-2">
                <button 
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs flex items-center justify-center gap-1"
                  onClick={handleReconnectClick}
                  disabled={isReconnecting}
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
