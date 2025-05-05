
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { GameType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionContext } from '@/contexts/SessionProvider';

const ALL_GAME_TYPES: GameType[] = ['mainstage', 'party', 'quiz', 'music', 'logo'];

export default function CreateSessionForm() {
  const [sessionName, setSessionName] = useState('');
  const [gameType, setGameType] = useState<GameType>('mainstage');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionTime, setSessionTime] = useState('');
  const [numberOfGames, setNumberOfGames] = useState(1);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { fetchSessions } = useSessionContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user is authenticated
    if (!user) {
      toast({
        title: 'Authentication Error',
        description: 'You must be logged in to create a session',
        variant: 'destructive'
      });
      return;
    }
    
    if (!sessionName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a session name',
        variant: 'destructive'
      });
      return;
    }
    if (!sessionDate || !sessionTime) {
      toast({
        title: 'Error',
        description: 'Please select date and time',
        variant: 'destructive'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionDateObj = new Date(`${sessionDate}T${sessionTime}`);
    const payload = {
      name: sessionName,
      game_type: gameType,
      session_date: sessionDate,
      created_at: sessionDateObj.toISOString(),
      number_of_games: Number(numberOfGames) || 1,
      access_code: accessCode,
      status: 'pending',
      created_by: user.id
    };
    
    console.log("Creating session with payload:", payload);
    
    try {
      const { error, data } = await supabase.from('game_sessions').insert([payload]).select();
      
      if (error) {
        console.error("Session creation error:", error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to create session',
          variant: 'destructive'
        });
        return;
      }
      
      console.log("Session created successfully:", data);
      
      // Refresh the sessions list after successful creation
      await fetchSessions();
      
      toast({
        title: 'Success',
        description: 'Game session created successfully',
      });
      
      // Reset the form
      setSessionName('');
      setGameType('mainstage');
      setSessionDate('');
      setSessionTime('');
      setNumberOfGames(1);
      setOpen(false);
    } catch (err) {
      console.error("Error creating session:", err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary">
          Create New Session
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Create New Bingo Session</DialogTitle>
          <DialogDescription>
            Set up a new game session for your players to join.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Session Name</Label>
            <Input
              id="name"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Enter session name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-date">Date</Label>
            <Input
              id="session-date"
              type="date"
              value={sessionDate}
              onChange={e => setSessionDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-time">Time</Label>
            <Input
              id="session-time"
              type="time"
              value={sessionTime}
              onChange={e => setSessionTime(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="number-of-games">Number of Games</Label>
            <Input
              id="number-of-games"
              type="number"
              min={1}
              value={numberOfGames}
              onChange={e => setNumberOfGames(Number(e.target.value))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="game-type">Game Type</Label>
            <select
              id="game-type"
              value={gameType}
              className="block w-full border rounded px-3 py-2"
              onChange={e => setGameType(e.target.value as GameType)}
            >
              {ALL_GAME_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
