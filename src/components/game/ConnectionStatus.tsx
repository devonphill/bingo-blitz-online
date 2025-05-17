
import React from 'react';
import { useNetworkStatus } from '@/contexts/NetworkStatusContext';
import { formatDistanceToNow } from 'date-fns';

// ConnectionStatus component displays the current connection status
const ConnectionStatus: React.FC = () => {
  const { isConnected, connectionState } = useNetworkStatus();

  // Format the connection status message
  const getStatusMessage = () => {
    switch (connectionState) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return `Status: ${connectionState}`;
    }
  };

  // Get appropriate connection status color
  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'text-green-600';
      case 'connecting':
        return 'text-yellow-600';
      default:
        return 'text-red-600';
    }
  };

  return (
    <div className="flex items-center space-x-2 text-sm">
      <div className="flex items-center">
        <div 
          className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} 
        />
        <span className={getStatusColor()}>{getStatusMessage()}</span>
      </div>
    </div>
  );
};

export default ConnectionStatus;
