
import React, { useState, useEffect } from 'react';
import { getNCMInstance } from '@/utils/NEWConnectionManager_SinglePointOfTruth';
import { WebSocketConnectionStatus } from '@/constants/websocketConstants';
import { RealtimeChannel } from '@supabase/supabase-js';

// Fix for the error: TS2358 - The left-hand side of an 'instanceof' expression must be of type 'any', an object type or a type parameter.
// Replace instanceof check with a different approach

const DebugPanel: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<WebSocketConnectionStatus | ''>('');
  const [activeSessions, setActiveSessions] = useState<string[]>([]);
  const [activeChannels, setActiveChannels] = useState<string[]>([]);
  const [lastError, setLastError] = useState('');

  useEffect(() => {
    const connectionManager = getNCMInstance();
    
    // Add status listener to update connection status
    const removeStatusListener = connectionManager.addOverallStatusListener((newStatus, isReady) => {
      setStatus(newStatus);
      setIsConnected(newStatus === 'connected' && isReady);
    });

    // Instead of using instanceof check, we can check properties that would be available
    const checkIfChannel = (obj: any): obj is RealtimeChannel => {
      return obj && 
        typeof obj === 'object' && 
        typeof obj.subscribe === 'function' && 
        typeof obj.unsubscribe === 'function';
    };

    // Initial status
    setStatus(connectionManager.getCurrentConnectionState());
    setIsConnected(connectionManager.isConnected());

    // Poll for active sessions and channels (for debugging only)
    const intervalId = setInterval(() => {
      // This information might not be publicly accessible from the connection manager
      // We would need to add accessor methods if needed
      /*
      if (connectionManager.currentSessionIdInternal) {
        setActiveSessions([connectionManager.currentSessionIdInternal]);
      }
      
      const channels: string[] = [];
      connectionManager.activeChannels.forEach((channel, name) => {
        if (checkIfChannel(channel) && channel.state === 'joined') {
          channels.push(name);
        }
      });
      setActiveChannels(channels);
      */
    }, 2000);

    return () => {
      removeStatusListener();
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="bg-gray-100 p-4 rounded shadow">
      <h3 className="font-bold mb-2">WebSocket Debug Panel</h3>
      <div className="space-y-2">
        <div>
          <span className="font-semibold">Connected: </span>
          <span className={isConnected ? "text-green-500" : "text-red-500"}>
            {isConnected ? "Yes" : "No"}
          </span>
        </div>
        <div>
          <span className="font-semibold">Status: </span>
          <span className={
            status === 'connected' ? "text-green-500" :
            status === 'connecting' ? "text-yellow-500" :
            "text-red-500"
          }>
            {status || "Unknown"}
          </span>
        </div>
        <div>
          <span className="font-semibold">Active Session: </span>
          {activeSessions.length > 0 ? activeSessions.join(", ") : "None"}
        </div>
        <div>
          <span className="font-semibold">Active Channels: </span>
          <div className="ml-4 text-xs">
            {activeChannels.length > 0 
              ? activeChannels.map(ch => <div key={ch}>{ch}</div>) 
              : "None"}
          </div>
        </div>
        {lastError && (
          <div className="text-red-500">
            <span className="font-semibold">Last Error: </span>
            {lastError}
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugPanel;
