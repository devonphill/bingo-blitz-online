
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSessionContext } from '@/contexts/SessionProvider';
import { useToast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';

export default function PlayerJoinForm() {
  const [playerCode, setPlayerCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { joinSession } = useSessionContext();
  const { toast } = useToast();

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
      console.log("Joining game with player code:", playerCode);
      const result = await joinSession(playerCode);
      
      if (result.success) {
        console.log("Successfully joined game:", result);
        localStorage.setItem('playerCode', playerCode);
        toast({
          title: "Success",
          description: "You have joined the game!",
        });
        
        // Navigate to the player game page with the player code in the URL
        console.log("Navigating to game page with player code:", playerCode);
        navigate(`/player/game/${playerCode}`, { replace: true });
      } else {
        console.error("Error joining game:", result.error);
        toast({
          title: "Could Not Join Game",
          description: result.error || "Invalid player code. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Exception during join:", error);
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
