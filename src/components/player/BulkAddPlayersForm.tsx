
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSessionContext } from "@/contexts/SessionProvider";
import { AdminTempPlayer } from "@/contexts/usePlayers";
import { generatePlayerCode } from '@/utils/accessCodeGenerator';

export default function BulkAddPlayersForm() {
  const [bulkPlayersText, setBulkPlayersText] = useState("");
  const [delimiter, setDelimiter] = useState(",");
  const [isLoading, setIsLoading] = useState(false);
  const { currentSession, bulkAddPlayers } = useSessionContext();
  const { toast } = useToast();

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentSession || !bulkAddPlayers) {
      toast({
        title: "Error",
        description: "No active session found",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Parse the bulk text
      const players = parseBulkPlayersText(bulkPlayersText, delimiter);
      
      if (players.length === 0) {
        toast({
          title: "No players found",
          description: "Please check your input format",
          variant: "destructive"
        });
        return;
      }
      
      // Add the players to the session
      const result = await bulkAddPlayers(currentSession.id, players);
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Added ${result.count || players.length} players to the session`
        });
        setBulkPlayersText("");
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to add players",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("Error adding players:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Parse bulk text into player objects
  const parseBulkPlayersText = (text: string, delimiter: string): AdminTempPlayer[] => {
    if (!text.trim()) return [];
    
    return text.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split(delimiter).map(part => part.trim());
        
        // Get each part with fallbacks
        const nickname = parts[0] || `Player ${Math.floor(Math.random() * 1000)}`;
        const email = parts[1] || "";
        const ticketCount = parseInt(parts[2], 10) || 1;
        
        // Generate a player code
        const playerCode = generatePlayerCode();
        
        return {
          nickname,
          email,
          ticketCount,
          playerCode,
          tickets: ticketCount
        };
      });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Add Players</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delimiter">Delimiter</Label>
            <Input 
              id="delimiter" 
              value={delimiter} 
              onChange={(e) => setDelimiter(e.target.value)}
              placeholder="Delimiter character"
              className="max-w-xs"
            />
            <p className="text-sm text-muted-foreground">
              Character used to separate name, email, and tickets (default: comma)
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="bulkText">Players List</Label>
            <Textarea 
              id="bulkText"
              value={bulkPlayersText}
              onChange={(e) => setBulkPlayersText(e.target.value)}
              placeholder="Name, Email, Tickets&#10;John Doe, john@example.com, 2&#10;Jane Smith, jane@example.com, 1"
              className="min-h-32"
            />
            <p className="text-sm text-muted-foreground">
              Enter one player per line with format: Name{delimiter} Email{delimiter} Tickets
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isLoading || !bulkPlayersText.trim()}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Players
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
