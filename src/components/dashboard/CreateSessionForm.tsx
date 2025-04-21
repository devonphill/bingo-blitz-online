
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSession } from '@/contexts/SessionContext';
import { GameType } from '@/types';
import { useToast } from '@/components/ui/use-toast';

export default function CreateSessionForm() {
  const [sessionName, setSessionName] = useState('');
  const [gameType, setGameType] = useState<GameType>('90-ball');
  const [open, setOpen] = useState(false);
  const { createSession } = useSession();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a session name',
        variant: 'destructive'
      });
      return;
    }
    
    createSession(sessionName, gameType);
    
    toast({
      title: 'Success',
      description: 'Game session created successfully',
    });
    
    setSessionName('');
    setGameType('90-ball');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary">
          Create New Session
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
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
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="game-type">Game Type</Label>
            <Select value={gameType} onValueChange={(value) => setGameType(value as GameType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select game type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="90-ball">90-Ball Bingo</SelectItem>
                <SelectItem value="80-ball">80-Ball Bingo</SelectItem>
                <SelectItem value="quiz">Quiz Bingo</SelectItem>
                <SelectItem value="music">Music Bingo</SelectItem>
                <SelectItem value="logo">Logo Bingo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit">Create Session</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
