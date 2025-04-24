
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { GameType } from "@/types";

interface GameRules {
  min_players: number;
  max_players: number;
  winning_patterns?: string[];
  question_time?: number;
  song_duration?: number;
  logo_display_time?: number;
}

export function GameRulesManager() {
  const [selectedType, setSelectedType] = useState<GameType>('mainstage');
  const [rules, setRules] = useState<GameRules | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const gameTypes: GameType[] = ['mainstage', 'party', 'quiz', 'music', 'logo'];

  useEffect(() => {
    loadRules(selectedType);
  }, [selectedType]);

  const loadRules = async (gameType: GameType) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('game_rules_config')
      .select('rules')
      .eq('game_type', gameType)
      .single();

    if (error) {
      toast({
        title: "Error loading rules",
        description: error.message,
        variant: "destructive"
      });
    } else if (data) {
      // Fixed: Cast the JSON data to GameRules with type assertion
      setRules(data.rules as unknown as GameRules);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!rules) return;
    
    setIsLoading(true);
    const { error } = await supabase
      .from('game_rules_config')
      .update({ rules: rules as unknown as Record<string, any> })
      .eq('game_type', selectedType);

    if (error) {
      toast({
        title: "Error saving rules",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Rules saved",
        description: `Game rules for ${selectedType} have been updated.`
      });
    }
    setIsLoading(false);
  };

  const updateRule = (key: keyof GameRules, value: any) => {
    if (rules) {
      setRules({ ...rules, [key]: value });
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Game Rules Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {gameTypes.map((type) => (
              <Button
                key={type}
                variant={selectedType === type ? 'default' : 'outline'}
                onClick={() => setSelectedType(type)}
                className="capitalize"
              >
                {type} Bingo
              </Button>
            ))}
          </div>

          {rules && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min-players">Minimum Players</Label>
                  <Input
                    id="min-players"
                    type="number"
                    value={rules.min_players}
                    onChange={(e) => updateRule('min_players', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-players">Maximum Players</Label>
                  <Input
                    id="max-players"
                    type="number"
                    value={rules.max_players}
                    onChange={(e) => updateRule('max_players', parseInt(e.target.value))}
                  />
                </div>
              </div>

              {selectedType === 'quiz' && (
                <div className="space-y-2">
                  <Label htmlFor="question-time">Question Time (seconds)</Label>
                  <Input
                    id="question-time"
                    type="number"
                    value={rules.question_time}
                    onChange={(e) => updateRule('question_time', parseInt(e.target.value))}
                  />
                </div>
              )}

              {selectedType === 'music' && (
                <div className="space-y-2">
                  <Label htmlFor="song-duration">Song Duration (seconds)</Label>
                  <Input
                    id="song-duration"
                    type="number"
                    value={rules.song_duration}
                    onChange={(e) => updateRule('song_duration', parseInt(e.target.value))}
                  />
                </div>
              )}

              {selectedType === 'logo' && (
                <div className="space-y-2">
                  <Label htmlFor="logo-time">Logo Display Time (seconds)</Label>
                  <Input
                    id="logo-time"
                    type="number"
                    value={rules.logo_display_time}
                    onChange={(e) => updateRule('logo_display_time', parseInt(e.target.value))}
                  />
                </div>
              )}

              <Button
                onClick={handleSave}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Saving..." : "Save Rules"}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
