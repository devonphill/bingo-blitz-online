
import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GameSession } from '@/types';
import { useNavigate } from 'react-router-dom';

interface SessionCardProps {
  session: GameSession;
}

export default function SessionCard({ session }: SessionCardProps) {
  const navigate = useNavigate();
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'active': return 'bg-green-100 text-green-800 border-green-300';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleManageSession = () => {
    navigate(`/caller/session/${session.id}`);
  };

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold flex justify-between items-center">
          {session.name}
          <Badge className={getStatusColor(session.status)}>
            {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="font-medium">Game Type:</div>
          <div>{session.gameType}</div>
          
          <div className="font-medium">Access Code:</div>
          <div className="font-mono bg-gray-100 px-2 py-1 rounded-md text-center">
            {session.accessCode}
          </div>
          
          <div className="font-medium">Created:</div>
          <div>{formatDate(session.createdAt)}</div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary"
          onClick={handleManageSession}
        >
          {session.status === 'pending' ? 'Start Game' : 'Manage Game'}
        </Button>
      </CardFooter>
    </Card>
  );
}
