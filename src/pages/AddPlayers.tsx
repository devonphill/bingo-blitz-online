
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import BulkAddPlayersForm from '@/components/player/BulkAddPlayersForm';
import AddPlayerForm from '@/components/player/AddPlayerForm';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from '@/contexts/SessionContext';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { GameSession } from '@/types';

export default function AddPlayers() {
  const { user } = useAuth();
  const { sessions } = useSession();
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSessionData() {
      setLoading(true);
      
      if (!sessionId) {
        setLoading(false);
        return;
      }
      
      console.log("Fetching session data for ID:", sessionId);
      
      // Try to find the session in the context first
      if (sessions.length > 0) {
        const foundSession = sessions.find(s => s.id === sessionId);
        if (foundSession) {
          setSession(foundSession);
          setLoading(false);
          return;
        }
      }
      
      try {
        // If not found in context, fetch directly from Supabase
        const { data, error } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
          
        if (data && !error) {
          console.log("Found session in Supabase:", data);
          const fetchedSession: GameSession = {
            id: data.id,
            name: data.name,
            gameType: data.game_type,
            createdBy: data.created_by,
            accessCode: data.access_code,
            status: data.status,
            createdAt: data.created_at
          };
          setSession(fetchedSession);
        } else {
          console.error("Error fetching session:", error);
        }
      } catch (err) {
        console.error("Exception fetching session:", err);
      }
      
      setLoading(false);
    }
    
    fetchSessionData();
  }, [sessionId, sessions]);

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
          {sessionId && (
            <>
              <AddPlayerForm sessionId={sessionId} />
              <BulkAddPlayersForm sessionId={sessionId} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
