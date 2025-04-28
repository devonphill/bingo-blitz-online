
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { useSessionContext } from '@/contexts/SessionProvider';
import { generatePlayerCode } from '@/utils/accessCodeGenerator';
import { AdminTempPlayer } from '@/contexts/usePlayers';

export default function BulkAddPlayersForm({ sessionId }: { sessionId: string }) {
  const [isAdding, setIsAdding] = useState(false);
  const [playersData, setPlayersData] = useState<string>('');
  const { toast } = useToast();
  const { bulkAddPlayers } = useSessionContext();

  const handleAddPlayers = async () => {
    if (!playersData.trim()) {
      toast({
        title: "Invalid input",
        description: "Please enter player data",
        variant: "destructive"
      });
      return;
    }

    setIsAdding(true);

    try {
      // Parse player data from textarea
      const players: AdminTempPlayer[] = playersData
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [nickname, email = '', ticketCount = '1'] = line.split(',').map(item => item.trim());
          return {
            nickname,
            email,
            playerCode: generatePlayerCode(),
            ticketCount: parseInt(ticketCount, 10) || 1,
            tickets: parseInt(ticketCount, 10) || 1
          };
        });

      if (!players.length) {
        toast({
          title: "Invalid format",
          description: "Please check your input format",
          variant: "destructive"
        });
        setIsAdding(false);
        return;
      }

      console.log("Bulk adding players:", players);

      if (bulkAddPlayers) {
        const result = await bulkAddPlayers(sessionId, players);
        console.log("Bulk add result:", result);
        
        if (result.success) {
          toast({
            title: "Players added",
            description: `Successfully added ${result.count || players.length} players`,
          });
          setPlayersData('');
        } else {
          toast({
            title: "Error",
            description: result.error || "Failed to add players",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Error",
          description: "Bulk add players function not available",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('Error adding players:', err);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-2">Bulk Add Players</h3>
        <p className="text-sm text-gray-500 mb-4">
          Enter one player per line in the format: Nickname, Email, Tickets
        </p>
        <Textarea
          rows={10}
          value={playersData}
          onChange={(e) => setPlayersData(e.target.value)}
          placeholder="John Doe, john@example.com, 2
Jane Smith, jane@example.com, 1"
        />
      </div>
      <Button
        onClick={handleAddPlayers}
        disabled={isAdding}
        className="w-full"
      >
        {isAdding ? "Adding Players..." : "Add Players"}
      </Button>
    </div>
  );
}
