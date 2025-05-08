
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { logWithTimestamp } from '@/utils/logUtils';

interface PlayerProps {
  players?: any[];
  isLoading?: boolean;
  onReconnect?: () => void;
  sessionId?: string;
  claimsData?: any[];
}

export default function PlayerList({ 
  players: initialPlayers, 
  isLoading = false, 
  onReconnect, 
  sessionId,
  claimsData = []
}: PlayerProps) {
  const [players, setPlayers] = useState<any[]>(initialPlayers || []);
  const [loading, setLoading] = useState(isLoading || true);
  const [error, setError] = useState<string | null>(null);

  // Load players when component mounts or session changes
  useEffect(() => {
    if (!sessionId) return;
    
    const fetchPlayers = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        if (data) {
          logWithTimestamp(`PlayerList: Loaded ${data.length} players for session ${sessionId}`, 'info');
          setPlayers(data);
        }
      } catch (err) {
        setError(`Failed to load players: ${(err as Error).message}`);
        console.error('Error fetching players:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
    
    // Set up subscription for player updates
    const channel = supabase.channel('player-list')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'players',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        logWithTimestamp('Player list change detected, refreshing players', 'info');
        fetchPlayers();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const handleRefresh = () => {
    if (onReconnect) {
      onReconnect();
    }
  };

  // Function to check if a player has a pending claim
  const hasPlayerClaim = (playerId: string): boolean => {
    return claimsData?.some(claim => claim.playerId === playerId) || false;
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="animate-pulse bg-gray-200 h-8 w-full rounded"></div>
        <div className="animate-pulse bg-gray-200 h-8 w-full rounded"></div>
        <div className="animate-pulse bg-gray-200 h-8 w-full rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 p-2">
        <p>{error}</p>
        <button 
          className="mt-2 text-blue-500 hover:text-blue-700" 
          onClick={handleRefresh}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!players?.length) {
    return (
      <div className="text-sm text-gray-500 p-2 text-center">
        <p>No players connected</p>
        <button 
          className="mt-2 text-sm text-blue-500 hover:text-blue-700 flex items-center justify-center gap-1 mx-auto" 
          onClick={handleRefresh}
        >
          <RefreshCw className="h-3 w-3" />
          <span>Refresh</span>
        </button>
      </div>
    );
  }

  return (
    <div className="text-sm">
      <div className="max-h-[200px] overflow-y-auto">
        {players.map((player) => (
          <div 
            key={player.id} 
            className={`flex items-center justify-between p-1.5 border-b border-gray-100 ${hasPlayerClaim(player.id) ? 'bg-red-50' : ''}`}
          >
            <div className="flex items-center">
              <User className="h-3 w-3 text-gray-400 mr-2" />
              <span>{player.nickname || player.player_code}</span>
            </div>
            <div>
              {hasPlayerClaim(player.id) && (
                <Badge variant="destructive" className="text-xs">CLAIM</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
