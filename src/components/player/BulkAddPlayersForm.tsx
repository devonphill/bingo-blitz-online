
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AdminTempPlayer, TempPlayer } from "@/types";
import { useSessionContext } from "@/contexts/SessionProvider";
import { useToast } from "@/hooks/use-toast";
import { generateAccessCode } from '@/utils/accessCodeGenerator';

export function BulkAddPlayersForm() {
  const [bulkData, setBulkData] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { bulkAddPlayers, currentSession } = useSessionContext();
  const { toast } = useToast();

  const parseBulkData = (data: string): AdminTempPlayer[] => {
    const lines = data.trim().split('\n');
    return lines
      .filter(line => line.trim())
      .map(line => {
        const [nickname, email, ticketsStr, playerCode] = line.split(',').map(part => part.trim());
        const tickets = parseInt(ticketsStr || '1', 10);
        
        return {
          nickname: nickname || 'Guest',
          email: email || '',
          tickets: tickets,
          ticketCount: tickets,
          playerCode: playerCode || generateAccessCode(6)
        };
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentSession) {
      toast({
        title: "Error",
        description: "No session selected",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      const parsedPlayers = parseBulkData(bulkData);
      
      if (parsedPlayers.length === 0) {
        toast({
          title: "Error",
          description: "No valid player data found",
          variant: "destructive"
        });
        return;
      }
      
      const result = await bulkAddPlayers(currentSession.id, parsedPlayers);
      
      if (result.success) {
        toast({
          title: "Players Added",
          description: `Successfully added ${result.count} players`
        });
        setBulkData('');
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to add players",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message || "An error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Add Players</CardTitle>
        <CardDescription>
          Add multiple players at once by entering each player on a new line with the format:
          <br />
          <code>Name, Email, Tickets, PlayerCode (optional)</code>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="bulkData">Player Data</Label>
              <Textarea
                id="bulkData"
                value={bulkData}
                onChange={(e) => setBulkData(e.target.value)}
                placeholder="John Doe, john@example.com, 2&#10;Jane Smith, jane@example.com, 3"
                rows={10}
                className="resize-none"
              />
            </div>
          </div>
          <Button type="submit" className="mt-4" disabled={isSubmitting || !bulkData.trim()}>
            {isSubmitting ? "Adding Players..." : "Add Players"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between text-sm text-muted-foreground">
        <p>Example: Mark Smith, mark@example.com, 2</p>
      </CardFooter>
    </Card>
  );
}
