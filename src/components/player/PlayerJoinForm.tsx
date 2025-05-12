
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSessionContext } from '@/contexts/SessionProvider';
import { useToast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { logWithTimestamp } from '@/utils/logUtils';

export default function PlayerJoinForm() {
  const [playerCode, setPlayerCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { joinSession } = useSessionContext();
  const { toast } = useToast();
  const { setPlayer } = usePlayerContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!playerCode.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter your player code.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      logWithTimestamp(`PlayerJoinForm: Joining game with player code: ${playerCode}`, 'info');
      const result = await joinSession(playerCode);
      
      if (result.success) {
        logWithTimestamp(`PlayerJoinForm: Successfully joined game with result: ${JSON.stringify(result)}`, 'info');
        
        // Save player info to localStorage 
        localStorage.setItem('playerCode', playerCode);
        localStorage.setItem('playerName', result.playerName || 'Player');
        
        if (result.playerId) {
          localStorage.setItem('playerId', result.playerId);
          logWithTimestamp(`PlayerJoinForm: Saved playerId to localStorage: ${result.playerId}`, 'info');
        }
        
        // Update player context
        setPlayer({
          id: result.playerId || '',
          name: result.playerName || 'Player',
          code: playerCode,
          sessionId: result.sessionId
        });
        logWithTimestamp(`PlayerJoinForm: Updated player context with id: ${result.playerId}`, 'info');
        
        if (result.sessionId) {
          localStorage.setItem('playerSessionId', result.sessionId);
          logWithTimestamp(`PlayerJoinForm: Saved sessionId to localStorage: ${result.sessionId}`, 'info');
        }
        
        toast({
          title: "Success",
          description: "You have joined the game!",
        });
        
        // Navigate to the player game page with the player code in the URL
        logWithTimestamp(`PlayerJoinForm: Navigating to game page with player code: ${playerCode}`, 'info');
        navigate(`/player/game/${playerCode}`, { replace: true });
      } else {
        logWithTimestamp(`PlayerJoinForm: Error joining game: ${result.error}`, 'error');
        toast({
          title: "Could Not Join Game",
          description: result.error || "Invalid player code. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      logWithTimestamp(`PlayerJoinForm: Exception during join: ${(error as Error).message}`, 'error');
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-[350px] mx-auto">
      <CardHeader>
        <CardTitle>Join Bingo Game</CardTitle>
        <CardDescription>Enter your player code to join.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              id="playerCode"
              placeholder="Enter your player code"
              value={playerCode}
              onChange={(e) => setPlayerCode(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              'Join Game'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
