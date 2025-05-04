
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { connectionManager } from "@/utils/connectionManager";
import { logWithTimestamp } from "@/utils/logUtils";

export default function NetworkDebugging() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [connections, setConnections] = useState<{id: string, status: string}[]>([]);
  const [messages, setMessages] = useState<{timestamp: string, type: string, payload: any}[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');

  useEffect(() => {
    // Check connection status periodically
    const intervalId = setInterval(() => {
      const isConnected = connectionManager.isConnected?.() || false;
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      
      // Get active channels if available
      if (connectionManager.getChannels) {
        try {
          const channels = connectionManager.getChannels();
          setConnections(channels.map((ch: any) => ({
            id: ch.topic || 'unknown',
            status: ch.state || 'unknown'
          })));
        } catch (err) {
          console.error("Error getting channels:", err);
        }
      }
    }, 2000);
    
    // Set up message capture
    const originalLog = console.log;
    const messageRegex = /Received broadcast|Sending broadcast|WebSocket|connection|channel/i;
    
    console.log = (...args) => {
      originalLog(...args);
      
      // Check if this is a message we care about
      const message = args.join(' ');
      if (messageRegex.test(message)) {
        const timestamp = new Date().toISOString();
        setMessages(prev => [
          { timestamp, type: 'log', payload: message },
          ...prev.slice(0, 19)
        ]);
      }
    };
    
    return () => {
      clearInterval(intervalId);
      console.log = originalLog;
    };
  }, []);
  
  // Force a reconnection
  const handleForceReconnect = () => {
    logWithTimestamp("Manual reconnection requested from debug panel", 'info');
    if (connectionManager.reconnect) {
      connectionManager.reconnect();
    }
    
    // Add a message to the log
    const timestamp = new Date().toISOString();
    setMessages(prev => [
      { timestamp, type: 'action', payload: 'Manual reconnection triggered' },
      ...prev
    ]);
  };
  
  // Test sending a broadcast
  const handleTestBroadcast = async () => {
    try {
      logWithTimestamp("Sending test broadcast message", 'info');
      
      const channel = supabase.channel('test-channel');
      await channel.subscribe();
      
      await channel.send({
        type: 'broadcast',
        event: 'test',
        payload: { message: 'Test message', timestamp: new Date().toISOString() }
      });
      
      // Add a message to the log
      const timestamp = new Date().toISOString();
      setMessages(prev => [
        { timestamp, type: 'action', payload: 'Test broadcast sent' },
        ...prev
      ]);
      
      // Clean up
      supabase.removeChannel(channel);
    } catch (err) {
      console.error("Error sending test broadcast:", err);
      
      // Add error to the log
      const timestamp = new Date().toISOString();
      setMessages(prev => [
        { timestamp, type: 'error', payload: `Error sending test broadcast: ${err}` },
        ...prev
      ]);
    }
  };
  
  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 left-4 z-40">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="bg-gray-800 text-white opacity-70 hover:opacity-100"
        >
          <Badge className={connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'} variant="secondary">
            •
          </Badge>
          <span className="ml-2">Network Debug</span>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="fixed bottom-4 left-4 z-40">
      <Card className="w-80 max-h-96 overflow-hidden shadow-xl">
        <CardHeader className="p-3 bg-gray-100">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm flex items-center">
              <Badge className={connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'} variant="secondary">
                •
              </Badge>
              <span className="ml-2">Network Debugger</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>
              ×
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-2 border-b flex justify-between">
            <Button variant="outline" size="sm" onClick={handleForceReconnect}>
              Force Reconnect
            </Button>
            <Button variant="outline" size="sm" onClick={handleTestBroadcast}>
              Test Broadcast
            </Button>
          </div>
          
          <div className="p-2 border-b">
            <h3 className="text-xs font-bold mb-1">Active Channels</h3>
            {connections.length === 0 ? (
              <div className="text-xs text-gray-500 italic">No active channels</div>
            ) : (
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {connections.map((conn, i) => (
                  <div key={i} className="text-xs flex justify-between">
                    <span className="truncate max-w-[150px]">{conn.id}</span>
                    <Badge variant={conn.status === 'SUBSCRIBED' ? 'outline' : 'secondary'}>
                      {conn.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-2">
            <h3 className="text-xs font-bold mb-1">Recent Messages</h3>
            <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
              {messages.length === 0 ? (
                <div className="text-gray-500 italic">No messages captured</div>
              ) : (
                messages.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`text-xs ${
                      msg.type === 'error' ? 'text-red-600' : 
                      msg.type === 'action' ? 'text-blue-600' : 
                      'text-gray-600'
                    }`}
                  >
                    <span className="opacity-60">{msg.timestamp.substring(11, 19)}</span>:{' '}
                    {typeof msg.payload === 'string' 
                      ? msg.payload.substring(0, 50) + (msg.payload.length > 50 ? '...' : '')
                      : JSON.stringify(msg.payload).substring(0, 50) + '...'}
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
