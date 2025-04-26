
import React from "react";
import { Button } from "@/components/ui/button";
import { WinPattern } from "@/types/winPattern";
import { PrizeDetails } from "@/types";

interface WinPatternSelectorProps {
  winLines: WinPattern[];
  onToggleWinline: (winline: WinPattern) => void;
  currentActiveWinline?: number;
  selectedPatterns?: string[];
  prizes?: { [patternId: string]: PrizeDetails };
}

export default function WinPatternSelector({
  winLines,
  onToggleWinline,
  currentActiveWinline,
  selectedPatterns = [],
  prizes = {}
}: WinPatternSelectorProps) {
  const sortedWinlines = [...winLines].sort((a, b) => {
    if (typeof a.id === 'string' && typeof b.id === 'string') {
      return a.id.localeCompare(b.id);
    } else if (typeof a.id === 'number' && typeof b.id === 'number') {
      return a.id - b.id;
    }
    return 0;
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center mb-2 font-medium text-base">Winlines:</div>
      <div className="flex flex-wrap gap-4 mb-2">
        {sortedWinlines.map((wl) => {
          const isSelected = typeof wl.id === 'string' 
            ? selectedPatterns.includes(wl.id) 
            : selectedPatterns.includes(String(wl.id));
          
          const isActive = typeof currentActiveWinline === 'number' && 
                          typeof wl.id === 'number' && 
                          currentActiveWinline === wl.id;
          
          return (
            <div key={String(wl.id)} className="flex items-center space-x-2">
              <Button
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                className={`${isSelected ? "bg-bingo-primary text-white" : ""} 
                  ${isActive ? "ring-2 ring-offset-2 ring-bingo-tertiary" : ""}`}
                onClick={() => onToggleWinline(wl)}
              >
                {wl.name}
              </Button>
              
              {isSelected && prizes[String(wl.id)] && (
                <span className="text-xs text-gray-600">
                  Prize: {prizes[String(wl.id)].amount || 'Set'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
