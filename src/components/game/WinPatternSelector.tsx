
import React from "react";
import { Button } from "@/components/ui/button";
import type { WinPatternConfig } from "@/hooks/useWinPatternManagement";

interface WinPatternSelectorProps {
  winPatternConfigs: WinPatternConfig[];
  onTogglePattern: (patternId: string) => void;
  onPrizeChange: (patternId: string, prize: string) => void;
  currentPattern: string | null;
}

export default function WinPatternSelector({
  winPatternConfigs,
  onTogglePattern,
  onPrizeChange,
  currentPattern,
}: WinPatternSelectorProps) {
  // Sort patterns by order
  const sortedPatterns = [...winPatternConfigs].sort((a, b) => a.order - b.order);
  
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center mb-2 font-medium text-base">Win Patterns:</div>
      <div className="flex flex-wrap gap-4 mb-2">
        {sortedPatterns.map((pattern) => (
          <div key={pattern.id} className="flex items-center space-x-2">
            <Button
              type="button"
              size="sm"
              variant={pattern.active ? "default" : "outline"}
              className={`${pattern.active ? "bg-bingo-primary text-white" : ""} 
                ${currentPattern === pattern.id ? "ring-2 ring-offset-2 ring-bingo-tertiary" : ""}`}
              onClick={() => onTogglePattern(pattern.id)}
            >
              {pattern.name}
            </Button>
            <input
              type="text"
              placeholder="Prize"
              className="border rounded px-2 py-1 w-24 text-xs"
              value={pattern.prize || ""}
              onChange={e => onPrizeChange(pattern.id, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
