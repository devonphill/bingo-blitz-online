
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

interface TempPlayer {
  playerCode: string;
  nickname: string;
  email: string;
  tickets: number;
}

function generatePlayerCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function BulkAddPlayersForm({ sessionId }: { sessionId: string }) {
  const { toast } = useToast();
  const [players, setPlayers] = useState<TempPlayer[]>([]);
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [tickets, setTickets] = useState(1);
  const [saving, setSaving] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    // Add player to the table, autogenerate a code and reset fields
    setPlayers((prev) => [
      ...prev,
      {
        playerCode: generatePlayerCode(),
        nickname,
        email,
        tickets: Number(tickets) || 1,
      }
    ]);
    setNickname('');
    setEmail('');
    setTickets(1);
  };

  const handleEdit = (index: number, field: keyof TempPlayer, value: string | number) => {
    setPlayers(players =>
      players.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      )
    );
  };

  const handleDelete = (index: number) => {
    setPlayers(players => players.filter((_, i) => i !== index));
  };

  const handleSaveAll = async () => {
    if (players.length === 0) {
      toast({ title: 'Nothing to save', description: 'Add at least one player.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    
    try {
      console.log("Attempting to add players to session ID:", sessionId);
      
      // Check if sessionId is a numerical timestamp instead of a UUID
      const isTimestamp = /^\d+$/.test(sessionId);
      
      if (isTimestamp) {
        // For timestamp sessions (local/temporary sessions)
        // Instead of trying to insert directly to Supabase, we'll use localStorage
        // This approach is for demonstration purposes; in a real app, you might want
        // to create a real session in the database first
        
        const localPlayers = JSON.parse(localStorage.getItem('localPlayers') || '[]');
        const playersToSave = players.map(p => ({
          ...p,
          sessionId,
          joinedAt: new Date().toISOString()
        }));
        
        localStorage.setItem('localPlayers', JSON.stringify([...localPlayers, ...playersToSave]));
        
        toast({
          title: 'Players saved locally',
          description: `${players.length} players saved to local storage. Note: These players are not saved to the database.`,
        });
        
        setPlayers([]);
        setSaving(false);
        return;
      }
      
      // If it's a valid UUID, insert into Supabase
      const { error } = await supabase.from('players').insert(
        players.map(p => ({
          player_code: p.playerCode,
          nickname: p.nickname,
          email: p.email,
          tickets: p.tickets,
          session_id: sessionId,
          joined_at: new Date().toISOString()
        }))
      );
  
      if (error) {
        console.error("Bulk add error:", error);
        toast({
          title: 'Some players failed',
          description: error.message || 'There were problems saving some or all players.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Players added successfully!',
          description: `${players.length} players committed to the database.`,
        });
        setPlayers([]);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      toast({
        title: 'Error saving players',
        description: 'An unexpected error occurred.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto my-6 animate-fade-in">
      <CardHeader>
        <CardTitle>Add Multiple Players</CardTitle>
        <CardDescription>
          Enter nickname, email, tickets, then add to the table. Edit/delete before committing.
          {/^\d+$/.test(sessionId) && (
            <div className="mt-2 p-2 bg-yellow-50 text-yellow-800 rounded-md text-sm">
              Note: This session ID appears to be a timestamp. Players will be saved locally and not to the database.
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col md:flex-row md:items-end gap-2" onSubmit={handleAdd}>
          <div>
            <Label>Nickname</Label>
            <Input type="text" value={nickname} onChange={e => setNickname(e.target.value)} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Tickets</Label>
            <Input type="number" min={1} value={tickets} onChange={e => setTickets(Number(e.target.value))} required />
          </div>
          <Button type="submit" variant="secondary">Add</Button>
        </form>
        {/* Table of entered players */}
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr>
                <th>Player Code</th>
                <th>Nickname</th>
                <th>Email</th>
                <th>Tickets</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={i} className="border-b">
                  <td>{p.playerCode}</td>
                  <td>
                    <Input value={p.nickname} onChange={e => handleEdit(i, 'nickname', e.target.value)} />
                  </td>
                  <td>
                    <Input value={p.email} type="email" onChange={e => handleEdit(i, 'email', e.target.value)} />
                  </td>
                  <td>
                    <Input value={p.tickets} type="number" min={1} onChange={e => handleEdit(i, 'tickets', Number(e.target.value))} />
                  </td>
                  <td>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(i)}>Delete</Button>
                  </td>
                </tr>
              ))}
              {players.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted-foreground">No players added yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button disabled={saving || players.length === 0} onClick={handleSaveAll}>
          {saving ? 'Saving...' : 'Save All Players'}
        </Button>
      </CardFooter>
    </Card>
  );
}
