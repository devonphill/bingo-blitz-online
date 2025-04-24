// src/components/caller/WinPatternSelector.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSessions } from '@/contexts/useSessions';
import { getGameRulesForType } from '@/game-rules/gameRulesRegistry';
// Import the corrected DefaultWinPattern type
import { DefaultWinPattern } from '@/game-rules/types';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
// *** REMOVED import { WinPatternConfig } from '@/hooks/useWinPatternManagement'; ***

export function WinPatternSelector() {
  const { currentSession, updateCurrentGameState, isLoading: isSessionLoading } = useSessions();
  const [availablePatterns, setAvailablePatterns] = useState<DefaultWinPattern[]>([]);
  const [selectedPatternIds, setSelectedPatternIds] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentGameType = currentSession?.current_game_state?.gameType;
  // Use optional chaining for safety
  const activePatternIdsFromState = currentSession?.current_game_state?.activePatternIds;

  // Effect to load default patterns when game type changes
  useEffect(() => {
    setAvailablePatterns([]); // Clear previous patterns immediately
    if (currentGameType) {
      try {
        const rules = getGameRulesForType(currentGameType);
        if (rules) {
             const defaultPatterns = rules.getDefaultWinPatterns();
             setAvailablePatterns(defaultPatterns);
             setError(null); // Clear previous errors on success
        } else {
             setError(`No rules implementation found for game type: ${currentGameType}`);
        }
      } catch (e) {
        console.error(`Error getting game rules for ${currentGameType}:`, e);
        setError(`Could not load patterns for game type: ${currentGameType}`);
      }
    }
  }, [currentGameType]);

  // Effect to initialize selection state from the session's current_game_state
  useEffect(() => {
    // Ensure activePatternIdsFromState is an array before creating a Set
    if (Array.isArray(activePatternIdsFromState)) {
      setSelectedPatternIds(new Set(activePatternIdsFromState));
    } else {
      setSelectedPatternIds(new Set()); // Reset if state is null, undefined, or not an array
    }
  }, [activePatternIdsFromState]);

  const handleCheckboxChange = (patternId: string, checked: boolean | 'indeterminate') => {
    setSelectedPatternIds(prev => {
      const next = new Set(prev);
      if (checked === true) {
        next.add(patternId);
      } else {
        next.delete(patternId);
      }
      return next;
    });
  };

  const handleConfirmSelection = useCallback(async () => {
    if (!currentSession || isUpdating) return;

    setIsUpdating(true);
    setError(null);
    const success = await updateCurrentGameState({
      activePatternIds: Array.from(selectedPatternIds),
    });

    if (!success) {
      setError("Failed to save win pattern selection.");
    } else {
      console.log("Win patterns updated successfully.");
       // Consider adding a visual success indicator briefly
    }
    setIsUpdating(false);
  }, [currentSession, selectedPatternIds, updateCurrentGameState, isUpdating]);

  const isLoading = isSessionLoading || isUpdating;

  // Improved loading/error/state handling for rendering
  if (isSessionLoading) {
      return <p>Loading session...</p>;
  }

  if (!currentSession || !currentSession.current_game_state) {
    return <p>No active game session selected or initialized.</p>;
  }

  if (!currentGameType) {
     return <p>Current game type not set.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Win Patterns for Game {currentSession.current_game_state.gameNumber} ({currentGameType})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {availablePatterns.length > 0 ? (
           availablePatterns.map((pattern) => (
            <div key={pattern.id} className="flex items-center space-x-2">
              <Checkbox
                id={`pattern-${pattern.id}`}
                checked={selectedPatternIds.has(pattern.id)}
                onCheckedChange={(checked) => handleCheckboxChange(pattern.id, checked)}
                disabled={isLoading}
              />
              <Label htmlFor={`pattern-${pattern.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {pattern.name} {/* Display user-friendly name */}
              </Label>
            </div>
          ))
        ) : (
          <p>No win patterns available for this game type.</p>
        )}
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </CardContent>
      <CardFooter>
         <Button onClick={handleConfirmSelection} disabled={isLoading || availablePatterns.length === 0}>
           {isUpdating ? "Saving..." : "Confirm Patterns"}
         </Button>
      </CardFooter>
    </Card>
  );
}
