import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GameSession, GameType, GameConfig } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSessionContext } from '@/contexts/SessionProvider';

export default function AddPlayers() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<GameSession>({
    id: '',
    name: '',
    gameType: 'mainstage',
    createdBy: '',
    accessCode: '',
    status: 'pending',
    createdAt: '',
    sessionDate: '',
    numberOfGames: 1,
    current_game: 1,
    lifecycle_state: 'setup',
    games_config: []
  });
  const [players, setPlayers] = useState<any[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [newPlayerTickets, setNewPlayerTickets] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { addPlayer, bulkAddPlayers, assignTicketsToPlayer } = useSessionContext();
  
  useEffect(() => {
    const fetchSessionById = async (sessionId: string) => {
      try {
        const { data, error } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
          
        if (error) throw error;
        
        if (data) {
          const session: GameSession = {
            id: data.id,
            name: data.name,
            gameType: data.game_type as GameType,
            createdBy: data.created_by,
            accessCode: data.access_code,
            status: data.status as 'pending' | 'active' | 'completed',
            createdAt: data.created_at,
            sessionDate: data.session_date,
            numberOfGames: data.number_of_games,
            current_game: data.current_game,
            lifecycle_state: data.lifecycle_state as 'setup' | 'live' | 'ended' | 'completed',
            games_config: Array.isArray(data.games_config) 
              ? (data.games_config as GameConfig[]) 
              : []
          };
          
          setSession(session);
        }
      } catch (error) {
        console.error('Error fetching session:', error);
      }
    };
    
    const fetchPlayers = async () => {
      if (!sessionId) return;
      
      try {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('session_id', sessionId)
          .order('joined_at', { ascending: false });
        
        if (error) {
          console.error("Error fetching players:", error);
          return;
        }
        
        setPlayers(data || []);
      } catch (err) {
        console.error("Exception fetching players:", err);
      }
    };
    
    fetchSessionById(sessionId);
    fetchPlayers();
  }, [sessionId, toast]);
  
  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionId || !newPlayerName.trim()) {
      toast({
        title: "Invalid input",
        description: "Please enter a player name.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const playerCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      if (addPlayer) {
        const result = await addPlayer(newPlayerName, sessionId, newPlayerEmail);
        
        if (result) {
          toast({
            title: "Player added",
            description: `${newPlayerName} has been added to the session.`,
          });
          
          if (newPlayerTickets > 0 && assignTicketsToPlayer) {
            const { data } = await supabase
              .from('players')
              .select('id')
              .eq('session_id', sessionId)
              .eq('nickname', newPlayerName)
              .single();
              
            if (data?.id) {
              await assignTicketsToPlayer(data.id, sessionId, newPlayerTickets);
            }
          }
          
          setNewPlayerName('');
          setNewPlayerEmail('');
          setNewPlayerTickets(1);
          
          fetchPlayers();
        } else {
          toast({
            title: "Error",
            description: "Failed to add player.",
            variant: "destructive",
          });
        }
      }
    } catch (err) {
      console.error("Error adding player:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleBulkImport = async () => {
    toast({
      title: "Bulk import",
      description: "Bulk import functionality would be implemented here.",
    });
  };
  
  const handleSessionUpdate = async (updates: Partial<GameSession>) => {
    try {
      const { data, error } = await supabase
        .from('game_sessions')
        .update(updates)
        .eq('id', sessionId)
        .select();
      
      if (error) throw error;
      
      if (data && data[0]) {
        const updatedSession: GameSession = {
          ...session,
          ...updates,
        };
        
        setSession(updatedSession);
        toast({
          title: "Success",
          description: "Session updated successfully."
        });
      }
    } catch (error) {
      console.error('Error updating session:', error);
      toast({
        title: "Error",
        description: "Failed to update session.",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Add Players to Session: {session?.name}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Add New Player</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddPlayer} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="playerName">Player Name</Label>
                  <Input
                    id="playerName"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="Enter player name"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="playerEmail">Email (optional)</Label>
                  <Input
                    id="playerEmail"
                    type="email"
                    value={newPlayerEmail}
                    onChange={(e) => setNewPlayerEmail(e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ticketCount">Number of Tickets</Label>
                  <Input
                    id="ticketCount"
                    type="number"
                    min="1"
                    max="10"
                    value={newPlayerTickets}
                    onChange={(e) => setNewPlayerTickets(parseInt(e.target.value))}
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Adding..." : "Add Player"}
                </Button>
              </form>
              
              <div className="mt-4">
                <Button variant="outline" className="w-full" onClick={handleBulkImport}>
                  Bulk Import Players
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Session Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <span className="font-medium">Access Code:</span> {session?.accessCode}
                </div>
                <div>
                  <span className="font-medium">Game Type:</span> {session?.gameType}
                </div>
                <div>
                  <span className="font-medium">Number of Games:</span> {session?.numberOfGames}
                </div>
                <div>
                  <span className="font-medium">Status:</span> {session?.status}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Players ({players.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {players.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Player Code</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Tickets</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map((player) => (
                      <TableRow key={player.id}>
                        <TableCell className="font-medium">{player.nickname}</TableCell>
                        <TableCell>{player.player_code}</TableCell>
                        <TableCell>{player.email || "-"}</TableCell>
                        <TableCell>{player.tickets}</TableCell>
                        <TableCell>
                          {new Date(player.joined_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No players have joined this session yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
