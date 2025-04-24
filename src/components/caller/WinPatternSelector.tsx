// src/components/caller/WinPatternSelector.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSessions } from '@/contexts/useSessions';
import { getGameRulesForType } from '@/game-rules/gameRulesRegistry';
import { DefaultWinPattern } from '@/game-rules/types';
import { Button } from "@/components/ui/button"; // Assuming shadcn Button
import { Checkbox } from "@/components/ui/checkbox"; // Assuming shadcn Checkbox
import { Label } from "@/components/ui/label"; // Assuming shadcn Label
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"; // Assuming shadcn Card

export function WinPatternSelector() {
    const { currentSession, updateCurrentGameState, isLoading: isSessionLoading } = useSessions();
    const [availablePatterns, setAvailablePatterns] = useState<DefaultWinPattern[]>([]);
    const [selectedPatternIds, setSelectedPatternIds] = useState<Set<string>>(new Set());
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentGameType = currentSession?.current_game_state?.gameType;
    const activePatternIdsFromState = currentSession?.current_game_state?.activePatternIds;

    // Effect to load default patterns when game type changes
    useEffect(() => {
        if (currentGameType) {
            try {
                const rules = getGameRulesForType(currentGameType);
                const defaultPatterns = rules.getDefaultWinPatterns();
                setAvailablePatterns(defaultPatterns);
            } catch (e) {
                console.error(`Error getting game rules for ${currentGameType}:`, e);
                setError(`Could not load patterns for game type: ${currentGameType}`);
                setAvailablePatterns([]);
            }
        } else {
            setAvailablePatterns([]); // Clear patterns if no game type
        }
    }, [currentGameType]);

    // Effect to initialize selection state from the session's current_game_state
    useEffect(() => {
        if (activePatternIdsFromState) {
            setSelectedPatternIds(new Set(activePatternIdsFromState));
        } else {
            setSelectedPatternIds(new Set()); // Reset if state is cleared
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
            activePatternIds: Array.from(selectedPatternIds), // Update only the active patterns
        });

        if (!success) {
            setError("Failed to save win pattern selection.");
            // Optional: Revert local state? Or rely on next state sync from useSessions
        } else {
            // Optionally show success feedback, though state sync should handle UI update
            console.log("Win patterns updated successfully.");
        }
        setIsUpdating(false);
    }, [currentSession, selectedPatternIds, updateCurrentGameState, isUpdating]);

    const isLoading = isSessionLoading || isUpdating;

    if (!currentSession || !currentSession.current_game_state) {
        return <p>No active game session selected or initialized.</p>;
    }

    if (availablePatterns.length === 0 && currentGameType) {
        return <p>No win patterns defined for game type: {currentGameType}</p>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Select Win Patterns for Game {currentSession.current_game_state.gameNumber} ({currentGameType})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {availablePatterns.map((pattern) => (
                    <div key={pattern.id} className="flex items-center space-x-2">
                        <Checkbox
                            id={`pattern-${pattern.id}`}
                            checked={selectedPatternIds.has(pattern.id)}
                            onCheckedChange={(checked) => handleCheckboxChange(pattern.id, checked)}
                            disabled={isLoading}
                        />
                        <Label htmlFor={`pattern-${pattern.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {pattern.name} ({pattern.id})
                        </Label>
                    </div>
                ))}
                {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            </CardContent>
            <CardFooter>
                <Button onClick={handleConfirmSelection} disabled={isLoading}>
                    {isUpdating ? "Saving..." : "Confirm Patterns"}
                </Button>
            </CardFooter>
        </Card>
    );
}
