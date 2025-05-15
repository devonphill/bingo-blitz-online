import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { GameDataContext, useGameData } from '@/context/GameDataContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { logWithTimestamp } from '@/utils/logUtils';
import { GameStatus } from '@/types/game';
import PlayerClaimCheckingNotification from './PlayerClaimCheckingNotification';

interface PlayerGameLayoutProps {
  children: React.ReactNode;
  sessionId: string;
  gameId: number;
  gameStatus: GameStatus | null;
  playerData: any;
}

export default function PlayerGameLayout({ children, sessionId, gameId, gameStatus, playerData }: PlayerGameLayoutProps) {
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [winPatterns, setWinPatterns] = useState<any[]>([]);
  const [currentWinPattern, setCurrentWinPattern] = useState<any | null>(null);
  const [isGameActive, setIsGameActive] = useState(false);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [gameTitle, setGameTitle] = useState<string | null>(null);
  const [gameType, setGameType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const instanceId = React.useRef(`PlayerGameLayout-${Math.random().toString(36).substring(2, 7)}`);

  // Use our WebSocket hook for connection status and event listening
  const { isConnected, lastError, listenForEvent, EVENTS } = useWebSocket(sessionId);

  // Custom logging function
  const log = useCallback((message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') => {
    logWithTimestamp(`PlayerGameLayout (${instanceId.current}): ${message}`, level);
  }, []);

  // Fetch initial game data
  useEffect(() => {
    if (!sessionId) {
      log('Session ID missing. Cannot initialize game data.', 'warn');
      return;
    }

    const initializeGame = async () => {
      setIsLoading(true);
      try {
        // Fetch initial game data
        log(`Fetching initial game data for session ${sessionId}`, 'info');
        const initialData = await useGameData(sessionId);

        if (initialData) {
          log(`Initial game data loaded successfully: ${JSON.stringify(initialData)}`, 'debug');
          setLastCalledNumber(initialData.lastCalledNumber || null);
          setCalledNumbers(initialData.calledNumbers || []);
          setWinPatterns(initialData.winPatterns || []);
          setCurrentWinPattern(initialData.currentWinPattern || null);
          setIsGameActive(initialData.isGameActive || false);
          setIsGameComplete(initialData.isGameComplete || false);
          setGameTitle(initialData.gameTitle || 'Bingo Game');
          setGameType(initialData.gameType || 'mainstage');
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
  }, [sessionId, log]);

  // Listen for WebSocket updates
  useEffect(() => {
    if (!sessionId) return;

    log('Setting up WebSocket event listeners', 'info');

    // Listen for number called events
    const numberListener = listenForEvent<{number: number, calledNumbers: number[]}>(
      EVENTS.NUMBER_CALLED,
      (data) => {
        log(`Number called: ${data.number}`, 'info');
        setLastCalledNumber(data.number);
        if (data.calledNumbers && Array.isArray(data.calledNumbers)) {
          setCalledNumbers(data.calledNumbers);
        } else {
          // If calledNumbers is not provided, append the new number to existing ones
          setCalledNumbers(prev => [...prev, data.number]);
        }
      }
    );
    
    // Listen for win pattern updates
    const patternListener = listenForEvent<{pattern: any}>(
      EVENTS.WIN_PATTERN_UPDATED,
      (data) => {
        log(`Win pattern updated: ${JSON.stringify(data.pattern)}`, 'info');
        setCurrentWinPattern(data.pattern);
      }
    );
    
    // Listen for game status updates
    const statusListener = listenForEvent<{status: GameStatus}>(
      EVENTS.GAME_STATUS_UPDATED,
      (data) => {
        log(`Game status updated: ${data.status}`, 'info');
        setIsGameActive(data.status === 'active');
        setIsGameComplete(data.status === 'complete');
      }
    );

    // We need to clean up when component unmounts
    return () => {
      log('Cleaning up WebSocket event listeners', 'info');
      numberListener();
      patternListener();
      statusListener();
    };
  }, [sessionId, listenForEvent, log, EVENTS]);

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
                    {lastError || connectionError || 'Connecting...'}
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
        isGameComplete,
        gameTitle,
        gameType
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
