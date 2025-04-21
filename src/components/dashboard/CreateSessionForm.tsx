import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

const ALL_GAME_TYPES: GameType[] = ['90-ball', '80-ball', 'quiz', 'music', 'logo', 'mixed'];

export default function CreateSessionForm() {
  const [sessionName, setSessionName] = useState('');
  const [gameType, setGameType] = useState<GameType>('90-ball');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionTime, setSessionTime] = useState('');
  const [numberOfGames, setNumberOfGames] = useState(1);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      created_by: ''
    };
    const { error } = await supabase.from('game_sessions').insert([payload]);
    if (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create session',
        variant: 'destructive'
      });
      return;
    }
    toast({
      title: 'Success',
      description: 'Game session created successfully',
    });
    setSessionName('');
    setGameType('90-ball');
    setSessionDate('');
    setSessionTime('');
    setNumberOfGames(1);
    setOpen(false);
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
            <Button type="submit">Create Session</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
