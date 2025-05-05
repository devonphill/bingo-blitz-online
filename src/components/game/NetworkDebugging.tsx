
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { logWithTimestamp } from "@/utils/logUtils";
import { useNetwork } from "@/contexts/NetworkStatusContext";

export default function NetworkDebugging() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<{timestamp: string, type: string, payload: any}[]>([]);
  
  // Use the network context
  const network = useNetwork();
  const { connectionState, isConnected, sessionId } = network;
  
  useEffect(() => {
    // Set up message capture
    const originalLog = console.log;
    const messageRegex = /supabase|database|subscription|connection|session_progress/i;
    
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
      console.log = originalLog;
    };
  }, []);
  
  // Force a reconnection
  const handleForceReconnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    logWithTimestamp("Manual reconnection requested from debug panel", 'info');
    
    if (sessionId) {
      // Use the network context to reconnect
      network.connect(sessionId);
    }
    
    // Add a message to the log
    const timestamp = new Date().toISOString();
    setMessages(prev => [
      { timestamp, type: 'action', payload: 'Manual reconnection triggered' },
      ...prev
    ]);
  };
  
  // Test database subscription
  const handleTestSubscription = async () => {
    try {
      logWithTimestamp("Testing database subscription", 'info');
      
      if (!sessionId) {
        const timestamp = new Date().toISOString();
        setMessages(prev => [
          { timestamp, type: 'error', payload: 'No active session ID available for test' },
          ...prev
        ]);
        return;
      }
      
      // Get current session progress
      const { data: progressData } = await supabase
        .from('sessions_progress')
        .select('id')
        .eq('session_id', sessionId)
        .single();
        
      if (!progressData) {
        const timestamp = new Date().toISOString();
        setMessages(prev => [
          { timestamp, type: 'error', payload: 'No session progress found for test' },
          ...prev
        ]);
        return;
      }
      
      // Update the timestamp to trigger subscription
      const { error } = await supabase
        .from('sessions_progress')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', progressData.id);
        
      if (error) {
        throw error;
      }
      
      // Add a message to the log
      const timestamp = new Date().toISOString();
      setMessages(prev => [
        { timestamp, type: 'action', payload: 'Subscription test sent' },
        ...prev
      ]);
    } catch (err) {
      console.error("Error testing subscription:", err);
      
      // Add error to the log
      const timestamp = new Date().toISOString();
      setMessages(prev => [
        { timestamp, type: 'error', payload: `Error testing subscription: ${err}` },
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
          <Badge className={isConnected ? 'bg-green-500' : 'bg-red-500'} variant="secondary">
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
              <Badge className={isConnected ? 'bg-green-500' : 'bg-red-500'} variant="secondary">
                •
              </Badge>
              <span className="ml-2">Database Network Debugger</span>
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
            <Button variant="outline" size="sm" onClick={handleTestSubscription}>
              Test Subscription
            </Button>
          </div>
          
          <div className="p-2 border-b">
            <h3 className="text-xs font-bold mb-1">Connection Status</h3>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              <div className="text-xs flex justify-between">
                <span>State:</span>
                <Badge variant={connectionState === 'connected' ? 'outline' : 'secondary'}>
                  {connectionState}
                </Badge>
              </div>
              <div className="text-xs flex justify-between">
                <span>Session:</span>
                <span className="truncate max-w-[150px] font-mono text-xs">
                  {sessionId || 'none'}
                </span>
              </div>
            </div>
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
