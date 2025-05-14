import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useNetwork } from '@/contexts/NetworkStatusContext';
import { useGameManager } from '@/contexts/GameManager';
import { logWithTimestamp } from '@/utils/logUtils';
import PlayerGameContent from './PlayerGameContent';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import ConnectionStatus from './ConnectionStatus';
import PlayerLobby from './PlayerLobby';

interface PlayerGameLoaderProps {
  sessionName: string;
  sessionId: string;
  playerCode: string;
  playerName?: string;
  brandingInfo?: any;
}

export default function PlayerGameLoader({
  sessionName,
  sessionId,
  playerCode,
  playerName,
  brandingInfo
}: PlayerGameLoaderProps) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoMarking, setAutoMarking] = useState(true);
  const [gameStatus, setGameStatus] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const router = useRouter();
  const { data: session } = useSession();
  const network = useNetwork();
  const { getSessionById } = useGameManager();

  // Load automarking preference from localStorage
  useEffect(() => {
    const storedAutoMarking = localStorage.getItem('autoMarking');
    if (storedAutoMarking !== null) {
      setAutoMarking(storedAutoMarking === 'true');
    }
  }, []);

  // Fetch tickets and session status on initial load
  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch tickets from API
      const response = await fetch(`/api/player/tickets?session_id=${sessionId}&player_code=${playerCode}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tickets: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setTickets(data);

      // Fetch session status
      const sessionData = await getSessionById(sessionId);
      if (!sessionData) {
        throw new Error('Failed to fetch session data');
      }
      setCurrentSession(sessionData);
      setGameStatus(sessionData.status);
    } catch (e: any) {
      logWithTimestamp(`Error fetching tickets: ${e.message}`, 'error');
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, playerCode, getSessionById]);

  // Fetch session status separately
  const fetchSessionStatus = useCallback(async () => {
    try {
      const sessionData = await getSessionById(sessionId);
      if (!sessionData) {
        throw new Error('Failed to fetch session data');
      }
      setCurrentSession(sessionData);
      setGameStatus(sessionData.status);
    } catch (e: any) {
      logWithTimestamp(`Error fetching session status: ${e.message}`, 'error');
      setError(e.message);
    }
  }, [sessionId, getSessionById]);

  // Refresh status and tickets
  const handleRefreshStatus = useCallback(() => {
    fetchTickets();
    fetchSessionStatus();
  }, [fetchTickets, fetchSessionStatus]);

  // Handle reconnect
  const handleReconnect = () => {
    network.connect(sessionId);
  };

  // Initial data fetch
  useEffect(() => {
    if (sessionId && playerCode) {
      fetchTickets();
      fetchSessionStatus();
    }
  }, [sessionId, playerCode, fetchTickets, fetchSessionStatus]);

  // Check authentication and session
  useEffect(() => {
    if (!session) {
      router.push('/auth/signin');
    }
  }, [session, router]);

  if (!session) {
    return <div>Please sign in to play.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">{sessionName}</h1>
          <ConnectionStatus 
            sessionId={sessionId}
            onReconnect={handleReconnect}
            className="mt-2"
          />
        </div>
      </header>

      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {isLoading && !session && (
            <PlayerLobby
              sessionName={sessionName}
              sessionId={sessionId}
              playerName={playerName}
              onRefreshStatus={handleRefreshStatus}
              errorMessage={error || null}
              gameStatus={gameStatus}
              brandingInfo={brandingInfo || {}}
            />
          )}

          {!isLoading && tickets.length > 0 && currentSession && (
            <PlayerGameContent
              tickets={tickets}
              currentSession={currentSession}
              autoMarking={autoMarking}
              setAutoMarking={setAutoMarking}
              playerCode={playerCode}
              playerName={playerName}
              playerId={session?.user?.id}
              sessionId={sessionId}
              onRefreshTickets={handleRefreshStatus}
              onReconnect={handleReconnect}
            />
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">Error:</strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {isLoading && session && (
            <div className="flex justify-center items-center h-64">
              <LoadingSpinner size="lg" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
