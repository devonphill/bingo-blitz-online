
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AddPlayerFormProps {
  sessionId: string;
  onPlayerAdded?: () => void;
}

export default function AddPlayerForm({ sessionId, onPlayerAdded }: AddPlayerFormProps) {
  const [playerCode, setPlayerCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);

    try {
      // Use direct supabase client to avoid context method
      const { error } = await supabase.from('players').insert({
        player_code: playerCode.toUpperCase(),
        nickname,
        session_id: sessionId,
        joined_at: new Date().toISOString(),
        tickets: 1
      });
      
      if (error) {
        console.error("Add player error:", error);
        toast({
          title: 'Failed to add player',
          description: 'Player code already in use or invalid.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Player Added',
          description: 'Player has been added to the session.',
        });
        setPlayerCode('');
        setNickname('');
        if (onPlayerAdded) onPlayerAdded();
      }
    } catch (err) {
      console.error("Add player exception:", err);
      toast({
        title: 'Error',
        description: 'Failed to add player, please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto animate-fade-in">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-xl font-bold tracking-tight">
          Add Player
        </CardTitle>
        <CardDescription>
          Enter a unique 6-character code and nickname for new player
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adminPlayerCode">Player Code</Label>
            <Input 
              id="adminPlayerCode" 
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
          <div className="space-y-2">
            <Label htmlFor="adminNickname">Nickname</Label>
            <Input 
              id="adminNickname" 
              type="text" 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              placeholder="Enter nickname"
            />
          </div>
          <Button 
            type="submit"
            className="w-full bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary"
            disabled={isAdding}
          >
            {isAdding ? 'Adding...' : 'Add Player'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
