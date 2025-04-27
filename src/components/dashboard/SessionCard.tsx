import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GameSession } from '@/types';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSessionContext } from '@/contexts/SessionProvider';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SessionCardProps {
  session: GameSession;
}

export default function SessionCard({ session }: SessionCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { fetchSessions } = useSessionContext();
  
  const handleStartCalling = () => {
    navigate(`/caller/session/${session.id}`);
  };
  
  const handleAddPlayers = () => {
    navigate(`/session/${session.id}/players/add`);
  };

  const handleDelete = async () => {
    const { error } = await supabase
      .from('game_sessions')
      .delete()
      .eq('id', session.id);

    if (error) {
      toast({
        title: "Error deleting session",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Session deleted",
        description: "The game session has been successfully deleted."
      });
      fetchSessions();
    }
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
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              size="icon"
              className="w-10 h-10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the game session
                and all associated player data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
