
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useSessionContext } from '@/contexts/SessionProvider';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export default function PlayerJoinForm() {
  const [playerCode, setPlayerCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { joinSession } = useSessionContext();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsJoining(true);

    try {
      const result = await joinSession(playerCode.toUpperCase());
      if (result.success && result.playerId) {
        localStorage.setItem('playerCode', playerCode.toUpperCase());
        localStorage.setItem('playerNickname', result.playerCode || '');
        localStorage.setItem('tickets', '1'); // Default value or fetch from result if available
        toast({
          title: 'Login successful',
          description: `Welcome, you've joined the game!`,
        });
        navigate('/player/game');
      } else {
        toast({
          title: 'Invalid code',
          description: result.error || 'No player found with this code. Please check and try again.',
          variant: 'destructive'
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to login. Please try again.',
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
          Enter your unique 6-character player code to log in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="playerCode">Player Code</Label>
            <Input 
              id="playerCode" 
              type="text" 
              value={playerCode}
              onChange={(e) => setPlayerCode(e.target.value.toUpperCase())}
              required
              placeholder="Enter 6-character code"
              maxLength={6}
              minLength={6}
              pattern="[A-Z0-9]{6}"
              title="6 alphanumeric characters, uppercase only"
            />
          </div>
          <CardFooter>
            <Button 
              className="w-full bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary"
              type="submit"
              disabled={isJoining}
            >
              {isJoining ? 'Joining...' : 'Join Game'}
            </Button>
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  );
}
