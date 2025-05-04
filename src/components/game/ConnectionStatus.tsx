
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { connectionManager } from '@/utils/connectionManager';
import { logWithTimestamp } from '@/utils/logUtils';

interface ConnectionStatusProps {
  state: 'disconnected' | 'connecting' | 'connected' | 'error';
  onReconnect?: () => void;
  showFull?: boolean;
  className?: string;
}

export default function ConnectionStatus({ 
  state = 'disconnected', 
  onReconnect, 
  showFull = false,
  className = ''
}: ConnectionStatusProps) {
  const [expanded, setExpanded] = useState(false);
  const [statusDetails, setStatusDetails] = useState<Record<string, any>>({});
  const [lastPing, setLastPing] = useState<number | null>(null);
  
  useEffect(() => {
    const updateConnectionDetails = () => {
      // Use the getStatus method of connectionManager
      const status = connectionManager.getStatus();
      // Make sure we're setting an object to match the Record<string, any> type
      setStatusDetails({ status });
      
      // Use the getLastPing method
      setLastPing(connectionManager.getLastPing());
    };
    
    // Update immediate and set interval
    updateConnectionDetails();
    const interval = setInterval(updateConnectionDetails, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  const getStatusColor = () => {
    switch (state) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-amber-500';
      case 'disconnected': return 'bg-red-500';
      case 'error': return 'bg-red-700';
      default: return 'bg-gray-500';
    }
  };
  
  const getStatusText = () => {
    switch (state) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Connection Error';
      default: return 'Unknown';
    }
  };
  
  const handleReconnectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    logWithTimestamp('User requested manual reconnection', 'info');
    if (onReconnect) {
      onReconnect();
    } else if (connectionManager.reconnect) {
      connectionManager.reconnect();
    }
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
        
        {(state === 'disconnected' || state === 'error') && (
          <button 
            className="ml-2 text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
            onClick={handleReconnectClick}
          >
            Reconnect
          </button>
        )}
      </div>
      
      {expanded && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full right-0 mt-2 bg-white shadow-lg rounded-md p-3 z-50 w-64"
        >
          <h4 className="font-bold mb-2">Connection Details</h4>
          <div className="text-xs space-y-1">
            <div>Status: <span className="font-semibold">{getStatusText()}</span></div>
            {lastPing !== null && (
              <div>
                Last ping: <span className="font-mono">{lastPing}ms ago</span>
              </div>
            )}
            
            {Object.entries(statusDetails).map(([key, value]) => {
              if (key !== 'lastPing' && value !== undefined) {
                return (
                  <div key={key}>
                    {key}: <span className="font-mono">{JSON.stringify(value)}</span>
                  </div>
                );
              }
              return null;
            })}
            
            <div className="pt-2">
              <button 
                className="w-full bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                onClick={handleReconnectClick}
              >
                Force Reconnect
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
