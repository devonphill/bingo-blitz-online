
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner';
import { useNetworkContext } from '@/contexts/network';
import { usePlayerContext } from '@/contexts/PlayerContext';

interface PlayerGameLoaderProps {
  children: React.ReactNode;
}

export default function PlayerGameLoader({ children }: PlayerGameLoaderProps) {
  const { playerCode } = useParams<{ playerCode: string }>();
  const navigate = useNavigate();
  const { player, loadPlayer } = usePlayerContext();
  const { connect } = useNetworkContext();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Load player data and connect to session
  useEffect(() => {
    const initializePlayer = async () => {
      if (!playerCode) {
        setError('No player code provided');
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Load player data
        const playerData = await loadPlayer(playerCode);
        
        if (!playerData || !playerData.sessionId) {
          setError('Player data not found or invalid');
          setIsLoading(false);
          return;
        }
        
        // Connect to game session
        connect(playerData.sessionId);
        
        setIsLoading(false);
      } catch (error) {
        setError('Failed to load player data');
        setIsLoading(false);
      }
    };
    
    initializePlayer();
  }, [playerCode, loadPlayer, connect]);
  
  // Handle errors
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <div className="text-red-500 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Error Loading Game</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => navigate('/player/join')}
        >
          Return to Join Page
        </button>
      </div>
    );
  }
  
  // Show loader while initializing
  if (isLoading || !player) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner />
        <span className="ml-3">Loading game session...</span>
      </div>
    );
  }
  
  // Render children once loaded
  return <>{children}</>;
}
