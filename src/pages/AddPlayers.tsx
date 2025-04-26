
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import BulkAddPlayersForm from '@/components/player/BulkAddPlayersForm';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionContext } from '@/contexts/SessionProvider';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { GameSession, GameType } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { getCurrentGameState } from '@/helpers/gameStateHelper';

export default function AddPlayers() {
  const { user } = useAuth();
  const { sessions, fetchSessions } = useSessionContext();
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      if (!sessionId) {
        setLoading(false);
        return;
      }
      await fetchSessions();
      const foundSession = sessions.find(s => s.id === sessionId);
      if (foundSession) {
        setSession({
          id: foundSession.id,
          name: foundSession.name,
          gameType: foundSession.gameType,
          createdBy: foundSession.createdBy,
          accessCode: foundSession.accessCode,
          status: foundSession.status,
          createdAt: foundSession.createdAt,
          sessionDate: foundSession.sessionDate || '',
          numberOfGames: foundSession.numberOfGames || 1,
          current_game_state: foundSession.current_game_state || getCurrentGameState(foundSession.gameType)
        });
        setLoading(false);
      } else {
        // Try to fetch directly from Supabase
        const { data, error } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
        if (data && !error) {
          setSession({
            id: data.id,
            name: data.name,
            gameType: data.game_type as GameType,
            createdBy: data.created_by,
            accessCode: data.access_code,
            status: data.status as 'pending' | 'active' | 'completed',
            createdAt: data.created_at,
            sessionDate: data.session_date,
            numberOfGames: data.number_of_games,
            current_game_state: getCurrentGameState(data.game_type as GameType)
          });
        } else {
          toast({
            title: "Session Not Found",
            description: "Could not find a session with that ID in the database.",
            variant: "destructive"
          });
        }
        setLoading(false);
      }
    }
    fetchData();
    // eslint-disable-next-line
  }, [sessionId]);

  if (!user) {
    navigate('/login');
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bingo-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading session data...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Session Not Found</h2>
          <Button onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-bingo-primary">Bingo Blitz</h1>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Welcome, <span className="font-semibold">{user?.email}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            className="mr-2"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Add Players to Session {session?.name || sessionId}
          </h2>
        </div>
        <div className="space-y-8">
          {session && (
            <BulkAddPlayersForm sessionId={session.id} />
          )}
        </div>
      </main>
    </div>
  );
}
