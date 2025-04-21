
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useSession } from '@/contexts/SessionContext';
import { useToast } from '@/components/ui/use-toast';

export default function PlayerJoinForm() {
  const [accessCode, setAccessCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { joinSession } = useSession();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsJoining(true);
    
    try {
      const success = await joinSession(accessCode, nickname);
      if (success) {
        toast({
          title: 'Successfully joined game',
          description: 'Welcome to the bingo session!',
        });
      } else {
        toast({
          title: 'Failed to join game',
          description: 'Invalid access code. Please check and try again.',
          variant: 'destructive'
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to join the game. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto animate-fade-in">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-3xl font-bold tracking-tight">
          Join Bingo Game
        </CardTitle>
        <CardDescription>
          Enter the access code provided by your host
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accessCode">Game Code</Label>
            <Input 
              id="accessCode" 
              type="text" 
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              required
              placeholder="Enter 6-digit code"
              maxLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nickname">Your Nickname</Label>
            <Input 
              id="nickname" 
              type="text" 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              placeholder="Enter your nickname"
            />
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary"
          onClick={handleSubmit}
          disabled={isJoining}
        >
          {isJoining ? 'Joining...' : 'Join Game'}
        </Button>
      </CardFooter>
    </Card>
  );
}
