
import React, { useState, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminTempPlayer, TempPlayer } from '@/types';
import { generateAccessCode } from '@/utils/accessCodeGenerator';
import { useToast } from '@/hooks/use-toast';

interface BulkAddPlayersFormProps {
  onSubmit: (players: AdminTempPlayer[]) => Promise<boolean>;
  isLoading: boolean;
}

export function BulkAddPlayersForm({ onSubmit, isLoading }: BulkAddPlayersFormProps) {
  const [players, setPlayers] = useState<AdminTempPlayer[]>([
    { nickname: "", email: "", ticketCount: 1, playerCode: generateAccessCode(6), tickets: 1 }
  ]);
  const { toast } = useToast();
  
  const handleAddRow = () => {
    setPlayers([
      ...players,
      { nickname: "", email: "", ticketCount: 1, playerCode: generateAccessCode(6), tickets: 1 }
    ]);
  };
  
  const handleRemoveRow = (index: number) => {
    if (players.length <= 1) {
      toast({
        title: "Cannot remove",
        description: "You must have at least one player",
        variant: "destructive"
      });
      return;
    }
    
    const updatedPlayers = [...players];
    updatedPlayers.splice(index, 1);
    setPlayers(updatedPlayers);
  };
  
  const handleInputChange = (index: number, field: keyof AdminTempPlayer, value: string | number) => {
    const updatedPlayers = [...players];
    
    if (field === 'ticketCount') {
      // Ensure ticket count is between 1 and 10
      const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
      updatedPlayers[index][field] = Math.max(1, Math.min(10, isNaN(numValue) ? 1 : numValue));
      updatedPlayers[index].tickets = updatedPlayers[index].ticketCount; // Keep tickets in sync
    } else if (field === 'playerCode') {
      // Force uppercase for player code
      updatedPlayers[index][field] = typeof value === 'string' ? value.toUpperCase() : value;
    } else {
      updatedPlayers[index][field] = value;
    }
    
    setPlayers(updatedPlayers);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all players have names
    const invalidPlayers = players.filter(p => !p.nickname.trim());
    if (invalidPlayers.length > 0) {
      toast({
        title: "Missing information",
        description: "All players must have a name",
        variant: "destructive"
      });
      return;
    }
    
    // Try to submit the players
    const success = await onSubmit(players);
    
    if (success) {
      toast({
        title: "Success",
        description: `Added ${players.length} players to the session`,
      });
      
      // Reset the form with one empty row
      setPlayers([
        { nickname: "", email: "", ticketCount: 1, playerCode: generateAccessCode(6), tickets: 1 }
      ]);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Multiple Players</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email (Optional)</TableHead>
                  <TableHead>Ticket Count</TableHead>
                  <TableHead>Player Code</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Input
                        value={player.nickname}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange(index, 'nickname', e.target.value)}
                        placeholder="Player name"
                        required
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="email"
                        value={player.email || ''}
                        onChange={(e) => handleInputChange(index, 'email', e.target.value)}
                        placeholder="Email (optional)"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={player.ticketCount}
                        onChange={(e) => handleInputChange(index, 'ticketCount', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={player.playerCode}
                        onChange={(e) => handleInputChange(index, 'playerCode', e.target.value)}
                        maxLength={6}
                        minLength={6}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveRow(index)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex justify-between mt-4">
            <Button type="button" variant="outline" onClick={handleAddRow}>
              + Add Player
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Adding Players..." : "Save All Players"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
