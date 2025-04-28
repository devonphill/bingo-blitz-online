import React, { useState, useEffect } from 'react';
import { useSessionContext } from '@/contexts/SessionProvider';
import BulkAddPlayersForm from '@/components/player/BulkAddPlayersForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function AddPlayers() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [tickets, setTickets] = useState(1);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [tokenCount, setTokenCount] = useState<number | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const { 
    currentSession, 
    setCurrentSession, 
    fetchSessions,
    addPlayer,
    fetchPlayers,
    players,
    isLoading
  } = useSessionContext();

  useEffect(() => {
    const loadSessionData = async () => {
      if (isInitialized) return;
      setPageLoading(true);
      
      try {
        if (!sessionId) {
          toast({
            title: "Error",
            description: "No session ID provided",
            variant: "destructive"
          });
          navigate('/dashboard');
          return;
        }
        
        console.log("Initializing AddPlayers page with sessionId:", sessionId);
        
        setCurrentSession(sessionId);
        
        if (fetchPlayers) {
          console.log("Fetching players for session:", sessionId);
          await fetchPlayers(sessionId);
          setIsInitialized(true);
        } else {
          console.warn("fetchPlayers function not available in context");
          toast({
            title: "Warning",
            description: "Could not fetch existing players",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("Error loading session data:", error);
        toast({
          title: "Error",
          description: "Failed to load session data",
          variant: "destructive"
        });
      } finally {
        setPageLoading(false);
      }
    };
    
    loadSessionData();
  }, [sessionId, setCurrentSession, fetchPlayers, navigate, toast, isInitialized]);

  useEffect(() => {
    const fetchTokenCount = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('token_count')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setTokenCount(data?.token_count ?? 0);
      } catch (err) {
        console.error('Error fetching token count:', err);
        toast({
          title: "Error",
          description: "Could not fetch available credits",
          variant: "destructive"
        });
      }
    };

    fetchTokenCount();
  }, [user]);

  const handleAddPlayer = async () => {
    if (!sessionId) {
      toast({
        title: "Error",
        description: "No session ID available",
        variant: "destructive"
      });
      return;
    }
    
    if (!nickname.trim()) {
      toast({
        title: "Error",
        description: "Nickname is required",
        variant: "destructive"
      });
      return;
    }

    if (tokenCount !== null && tokenCount < 1) {
      toast({
        title: "Insufficient Credits",
        description: (
          <div>
            You need credits to add players.{" "}
            <a href="/add-tokens" className="underline">Add Credits</a>
          </div>
        ),
        variant: "destructive"
      });
      return;
    }
    
    setIsAddingPlayer(true);
    
    try {
      if (addPlayer) {
        const playerId = await addPlayer(sessionId, {
          nickname,
          email,
          tickets,
          playerCode: ''
        });
        
        if (playerId) {
          if (user) {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ token_count: (tokenCount ?? 0) - 1 })
              .eq('id', user.id);

            if (updateError) throw updateError;
            
            setTokenCount(prev => prev !== null ? prev - 1 : null);
          }

          toast({
            title: "Success",
            description: `Player ${nickname} was added successfully`,
          });
          
          setNickname('');
          setEmail('');
          setTickets(1);
          
          if (fetchPlayers) {
            await fetchPlayers(sessionId);
          }
        }
      } else {
        toast({
          title: "Error",
          description: "Add player function not available",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error adding player:', error);
      toast({
        title: "Error",
        description: "Failed to add player",
        variant: "destructive"
      });
    } finally {
      setIsAddingPlayer(false);
    }
  };

  if (pageLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading player data...</p>
        </div>
      </div>
    );
  }

  if (!currentSession && !pageLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Session Not Found</CardTitle>
            <CardDescription>
              The requested session could not be found.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/dashboard')}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Players to Session</CardTitle>
          <CardDescription>
            Add individual players or bulk add players to the current bingo session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Add Individual Player</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nickname">Nickname</Label>
                  <Input
                    id="nickname"
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    placeholder="Player Nickname"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="player@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tickets">Number of Tickets</Label>
                  <Input
                    id="tickets"
                    type="number"
                    min={1}
                    value={tickets}
                    onChange={e => setTickets(parseInt(e.target.value) || 1)}
                  />
                </div>
                <Button
                  onClick={handleAddPlayer}
                  disabled={isAddingPlayer}
                  className="w-full"
                >
                  {isAddingPlayer ? "Adding..." : `Add Player (1 Token)`}
                </Button>
              </div>
            </div>
            
            <div>
              {sessionId && <BulkAddPlayersForm sessionId={sessionId} />}
            </div>
          </div>
          
          <div className="mt-8">
            <h3 className="text-lg font-medium mb-4">Current Players ({players?.length || 0})</h3>
            <div className="overflow-auto max-h-80">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-4">Nickname</th>
                    <th className="py-2 px-4">Code</th>
                    <th className="py-2 px-4">Email</th>
                    <th className="py-2 px-4">Tickets</th>
                  </tr>
                </thead>
                <tbody>
                  {players && players.length > 0 ? (
                    players.map(player => (
                      <tr key={player.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-4">{player.nickname}</td>
                        <td className="py-2 px-4">{player.playerCode}</td>
                        <td className="py-2 px-4">{player.email || '-'}</td>
                        <td className="py-2 px-4">{player.tickets}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-gray-500">
                        No players added yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
