import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { GameDataContext } from '@/context/GameDataContext';
import { useGameData } from '@/hooks/useGameData';
import { useWebSocket } from '@/hooks/useWebSocket';
import { logWithTimestamp } from '@/utils/logUtils';
import { GameStatus } from '@/types/game';
import { getWebSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';
import PlayerClaimCheckingNotification from './PlayerClaimCheckingNotification';

interface PlayerGameLayoutProps {
  children: React.ReactNode;
  sessionId: string;
  gameId: number;
  gameStatus: GameStatus | null;
  playerData: any;
}

export default function PlayerGameLayout({ children, sessionId, gameId, gameStatus, playerData }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [gameData, setGameData] = useState(null);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [winPatterns, setWinPatterns] = useState<any[]>([]);
  const [currentWinPattern, setCurrentWinPattern] = useState<any | null>(null);
  const [isGameActive, setIsGameActive] = useState(false);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [gameTitle, setGameTitle] = useState<string | null>(null);
  const [gameType, setGameType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const instanceId = React.useRef(`PlayerGameLayout-${Math.random().toString(36).substring(2, 7)}`);

  // Custom logging function
  const log = useCallback((message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') => {
    logWithTimestamp(`PlayerGameLayout (${instanceId.current}): ${message}`, level);
  }, []);

  // Fetch initial game data and set up WebSocket connection
  useEffect(() => {
    if (!sessionId || !session?.user?.email) {
      log('Session ID or user email missing. Redirecting to home.', 'warn');
      router.push('/');
      return;
    }

    const initializeGame = async () => {
      setIsLoading(true);
      try {
        // Fetch initial game data
        log(`Fetching initial game data for session ${sessionId}`, 'info');
        const initialData = await useGameData(sessionId);

        if (initialData) {
          setGameData(initialData);
          setLastCalledNumber(initialData.lastCalledNumber || null);
          setCalledNumbers(initialData.calledNumbers || []);
          setWinPatterns(initialData.winPatterns || []);
          setCurrentWinPattern(initialData.currentWinPattern || null);
          setIsGameActive(initialData.isGameActive || false);
          setIsGameComplete(initialData.isGameComplete || false);
          setGameTitle(initialData.gameTitle || 'Bingo Game');
          setGameType(initialData.gameType || 'mainstage');
          log(`Initial game data loaded successfully: ${JSON.stringify(initialData)}`, 'debug');
        } else {
          log('Failed to load initial game data.', 'error');
          setConnectionError('Failed to load initial game data.');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Error fetching initial game data: ${errorMessage}`, 'error');
        setConnectionError(`Error loading game data: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    };

    initializeGame();
  }, [sessionId, session?.user?.email, router, log]);

  // WebSocket setup and message handling
  useEffect(() => {
    if (!sessionId) return;

    const webSocketService = getWebSocketService();

    const onConnect = () => {
      log('WebSocket connected successfully.', 'info');
      setIsConnected(true);
      setConnectionError(null);
    };

    const onDisconnect = () => {
      log('WebSocket disconnected.', 'warn');
      setIsConnected(false);
      setConnectionError('WebSocket disconnected. Reconnecting...');
    };

    const onError = (error: any) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`WebSocket error: ${errorMessage}`, 'error');
      setIsConnected(false);
      setConnectionError(`WebSocket error: ${errorMessage}`);
    };

    const handleNumberCalled = (number: number) => {
      log(`Number called: ${number}`, 'info');
      setLastCalledNumber(number);
      setCalledNumbers(prevNumbers => [...prevNumbers, number]);
    };

    const handleWinPatternUpdate = (pattern: any) => {
      log(`Win pattern updated: ${JSON.stringify(pattern)}`, 'info');
      setCurrentWinPattern(pattern);
    };

    const handleGameStatusUpdate = (status: GameStatus) => {
      log(`Game status updated: ${status}`, 'info');
      setIsGameActive(status === 'active');
      setIsGameComplete(status === 'complete');
    };

    const subscribeToGameUpdates = async () => {
      try {
        // Subscribe to the game updates channel
        const channel = webSocketService.subscribeToChannel(CHANNEL_NAMES.GAME_UPDATES, sessionId);

        if (channel) {
          // Bind WebSocket events to handlers
          channel.on(EVENT_TYPES.NUMBER_CALLED, handleNumberCalled);
          channel.on(EVENT_TYPES.WIN_PATTERN_UPDATED, handleWinPatternUpdate);
          channel.on(EVENT_TYPES.GAME_STATUS_UPDATED, handleGameStatusUpdate);

          // Set up WebSocket event listeners
          webSocketService.onConnect(onConnect);
          webSocketService.onDisconnect(onDisconnect);
          webSocketService.onError(onError);

          log('Subscribed to game updates channel.', 'info');
          setIsConnected(true);
          setConnectionError(null);
        } else {
          log('Failed to subscribe to game updates channel.', 'error');
          setIsConnected(false);
          setConnectionError('Failed to subscribe to game updates. Check console for details.');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Error subscribing to game updates: ${errorMessage}`, 'error');
        setIsConnected(false);
        setConnectionError(`Error subscribing to game updates: ${errorMessage}`);
      }
    };

    subscribeToGameUpdates();

    // Clean up WebSocket subscriptions and event listeners
    return () => {
      webSocketService.offConnect(onConnect);
      webSocketService.offDisconnect(onDisconnect);
      webSocketService.offError(onError);

      const channel = webSocketService.getChannel(CHANNEL_NAMES.GAME_UPDATES, sessionId);
      if (channel) {
        channel.off(EVENT_TYPES.NUMBER_CALLED, handleNumberCalled);
        channel.off(EVENT_TYPES.WIN_PATTERN_UPDATED, handleWinPatternUpdate);
        channel.off(EVENT_TYPES.GAME_STATUS_UPDATED, handleGameStatusUpdate);
        webSocketService.unsubscribeFromChannel(CHANNEL_NAMES.GAME_UPDATES, sessionId);
        log('Unsubscribed from game updates channel and removed event listeners.', 'info');
      }
    };
  }, [sessionId, log]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-md py-4">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div>
            {isLoading ? (
              <Skeleton className="h-8 w-48" />
            ) : (
              <h1 className="text-xl font-semibold">{gameTitle}</h1>
            )}
            {gameType && (
              <Badge variant="secondary" className="ml-2">{gameType}</Badge>
            )}
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                {isConnected ? (
                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-500">
                    <CheckCircle2 className="h-4 w-4 mr-1 inline-block" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-500">
                    <AlertTriangle className="h-4 w-4 mr-1 inline-block" />
                    {connectionError || 'Connecting...'}
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
      </header>
      
      <GameDataContext.Provider value={{
        sessionId,
        gameId,
        gameStatus,
        lastCalledNumber,
        calledNumbers,
        winPatterns,
        currentWinPattern,
        isGameActive,
        isGameComplete
      }}>
        {children}
      </GameDataContext.Provider>

      {/* Add the claim checking notification component */}
      <PlayerClaimCheckingNotification 
        sessionId={sessionId}
        playerCode={playerData?.playerCode || playerData?.player_code}
      />
      
    </div>
  );
}
