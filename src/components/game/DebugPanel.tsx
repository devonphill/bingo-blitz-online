import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { logWithTimestamp } from '@/utils/logUtils';
import { connectionManager } from '@/utils/connectionManager';

interface DebugPanelProps {
  initiallyExpanded?: boolean;
}

export default function DebugPanel({ initiallyExpanded = false }: DebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [isEnabled, setIsEnabled] = useState(!!localStorage.getItem('debug-panel-enabled'));
  const [debugEvents, setDebugEvents] = useState<Array<{time: Date; message: string; level: string}>>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [lastPing, setLastPing] = useState<number | null>(null);
  
  // Toggle debug panel visibility
  const toggleDebugPanel = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    if (newState) {
      localStorage.setItem('debug-panel-enabled', 'true');
    } else {
      localStorage.removeItem('debug-panel-enabled');
    }
  };
  
  // Keep track of connection events
  useEffect(() => {
    if (!isEnabled) return;
    
    const checkConnection = () => {
      const isConnected = connectionManager.isConnected?.() || false;
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      
      // Use the new getLastPing method
      setLastPing(connectionManager.getLastPing());
    };
    
    // Check connection immediately
    checkConnection();
    
    // Set up interval to check connection status
    const interval = setInterval(checkConnection, 5000);
    
    // Create an event listener to capture debug logs
    const captureLog = (message: string, level: string) => {
      setDebugEvents(prev => {
        const newEvents = [...prev, { time: new Date(), message, level }];
        return newEvents.slice(-20); // Keep only last 20 events
      });
    };
    
    // Override console methods to capture logs
    const originalDebug = console.debug;
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.debug = (...args) => {
      originalDebug(...args);
      captureLog(args.join(' '), 'debug');
    };
    
    console.log = (...args) => {
      originalLog(...args);
      captureLog(args.join(' '), 'info');
    };
    
    console.warn = (...args) => {
      originalWarn(...args);
      captureLog(args.join(' '), 'warn');
    };
    
    console.error = (...args) => {
      originalError(...args);
      captureLog(args.join(' '), 'error');
    };
    
    return () => {
      clearInterval(interval);
      // Restore original console methods
      console.debug = originalDebug;
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, [isEnabled]);
  
  if (!isEnabled) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button 
          onClick={toggleDebugPanel}
          className="bg-gray-800 text-white p-2 rounded-full shadow-lg opacity-50 hover:opacity-100"
          title="Enable Debug Panel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="m15 9-6 6" />
            <path d="m9 9 6 6" />
          </svg>
        </button>
      </div>
    );
  }
  
  return (
    <div className="fixed z-50 bottom-4 right-4">
      <div className="bg-gray-900 bg-opacity-90 text-white rounded-lg shadow-xl overflow-hidden border border-gray-700 w-80">
        <div 
          className="flex items-center justify-between p-2 bg-gray-800 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
            <h3 className="text-sm font-semibold">Debug Panel</h3>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                connectionManager.reconnect?.();
              }}
              className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-0.5 rounded"
            >
              Reconnect
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleDebugPanel();
              }}
              className="text-xs bg-red-600 hover:bg-red-700 px-2 py-0.5 rounded"
            >
              Close
            </button>
          </div>
        </div>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-gray-900 p-2 text-xs"
            >
              <div className="p-1 mb-2 bg-gray-800 rounded">
                <div className="grid grid-cols-2 gap-2">
                  <div>Status: <span className="font-bold">{connectionStatus}</span></div>
                  <div>Last Ping: <span className="font-mono">{lastPing !== null ? `${lastPing}ms` : 'N/A'}</span></div>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded overflow-hidden">
                <div className="text-center p-1 bg-gray-700 text-xs">Event Log</div>
                <div className="h-32 overflow-y-auto p-1 font-mono">
                  {debugEvents.map((event, i) => (
                    <div 
                      key={i} 
                      className={`text-xs mb-1 ${
                        event.level === 'error' ? 'text-red-400' :
                        event.level === 'warn' ? 'text-yellow-400' :
                        event.level === 'debug' ? 'text-blue-400' :
                        'text-green-400'
                      }`}
                    >
                      <span className="text-gray-400">{event.time.toTimeString().split(' ')[0]}</span>: {event.message.substring(0, 60)}
                      {event.message.length > 60 ? '...' : ''}
                    </div>
                  ))}
                  
                  {debugEvents.length === 0 && (
                    <div className="text-gray-500 text-center p-2">No events yet</div>
                  )}
                </div>
              </div>
              
              <div className="mt-2 grid grid-cols-2 gap-1">
                <button 
                  onClick={() => setDebugEvents([])}
                  className="text-xs bg-gray-700 hover:bg-gray-600 p-1 rounded"
                >
                  Clear Logs
                </button>
                <button 
                  onClick={() => {
                    logWithTimestamp('Manual log event from debug panel', 'debug');
                  }}
                  className="text-xs bg-gray-700 hover:bg-gray-600 p-1 rounded"
                >
                  Test Log
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
