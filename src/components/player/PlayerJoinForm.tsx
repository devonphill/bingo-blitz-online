
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSessionContext } from '@/contexts/SessionProvider';
import { toast } from '@/components/ui/use-toast';
import { Loader } from 'lucide-react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { logWithTimestamp } from '@/utils/logUtils';
import { supabase } from '@/integrations/supabase/client';

export default function PlayerJoinForm() {
  const [playerCode, setPlayerCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { joinSession } = useSessionContext();
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
      logWithTimestamp(`PlayerJoinForm: Looking up player data for code: ${playerCode}`, 'info');
      
      // First fetch the player data directly from Supabase to get session_id and player.id
      const { data: playerData, error: playerLookupError } = await supabase
        .from('players')
        .select('id, nickname, session_id')
        .eq('player_code', playerCode)
        .single();
      
      if (playerLookupError || !playerData) {
        logWithTimestamp(`PlayerJoinForm: Error finding player: ${playerLookupError?.message || 'Player not found'}`, 'error');
        toast({
          title: "Invalid Player Code",
          description: "We couldn't find a player with this code. Please check and try again.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      
      logWithTimestamp(`PlayerJoinForm: Found player with ID: ${playerData.id} and session: ${playerData.session_id}`, 'info');
      
      // Now use the session context join function for compatibility with existing code
      const result = await joinSession(playerCode);
      
      if (result.success) {
        logWithTimestamp(`PlayerJoinForm: Successfully joined game with result: ${JSON.stringify(result)}`, 'info');
        
        // Save player info to localStorage 
        localStorage.setItem('playerCode', playerCode);
        localStorage.setItem('playerName', playerData.nickname || 'Player');
        localStorage.setItem('playerId', playerData.id);
        localStorage.setItem('playerSessionId', playerData.session_id);
        
        // Update player context
        setPlayer({
          id: playerData.id,
          name: playerData.nickname || 'Player',
          code: playerCode,
          sessionId: playerData.session_id
        });
        logWithTimestamp(`PlayerJoinForm: Updated player context with id: ${playerData.id} and sessionId: ${playerData.session_id}`, 'info');
        
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
