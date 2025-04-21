
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GameSession } from '@/types';
import { format } from 'date-fns';

interface SessionCardProps {
  session: GameSession;
}

export default function SessionCard({ session }: SessionCardProps) {
  const navigate = useNavigate();
  
  const handleStartCalling = () => {
    navigate(`/caller/session/${session.id}`);
  };
  
  const handleAddPlayers = () => {
    navigate(`/add-players/${session.id}`);
  };

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">{session.name}</CardTitle>
        <CardDescription>
          Access Code: <span className="font-mono font-bold">{session.accessCode}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm text-gray-500">
          Game Type: <span className="font-medium text-gray-700">{session.gameType}</span>
        </div>
        <div className="text-sm text-gray-500">
          Created: <span className="font-medium text-gray-700">
            {format(new Date(session.createdAt), 'PPP')}
          </span>
        </div>
        <div className="text-sm text-gray-500">
          Status: <span className="font-medium text-gray-700 capitalize">{session.status}</span>
        </div>
      </CardContent>
      <CardFooter className="pt-2 gap-2 flex-col sm:flex-row">
        <Button 
          className="w-full bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary"
          onClick={handleStartCalling}
        >
          Start Calling
        </Button>
        <Button 
          className="w-full" 
          variant="outline"
          onClick={handleAddPlayers}
        >
          Add Players
        </Button>
      </CardFooter>
    </Card>
  );
}
