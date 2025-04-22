
import React from "react";
import { Button } from "@/components/ui/button";
import type { Winline } from "@/hooks/useWinPatternManagement";

interface WinPatternSelectorProps {
  winLines: Winline[];
  onToggleWinline: (winlineId: number) => void;
  currentActiveWinline?: number;
}

export default function WinPatternSelector({
  winLines,
  onToggleWinline,
  currentActiveWinline,
}: WinPatternSelectorProps) {
  const sortedWinlines = [...winLines].sort((a, b) => a.id - b.id);

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center mb-2 font-medium text-base">Winlines:</div>
      <div className="flex flex-wrap gap-4 mb-2">
        {sortedWinlines.map((wl) => (
          <div key={wl.id} className="flex items-center space-x-2">
            <Button
              type="button"
              size="sm"
              variant={wl.active ? "default" : "outline"}
              className={`${wl.active ? "bg-bingo-primary text-white" : ""} 
                ${currentActiveWinline === wl.id ? "ring-2 ring-offset-2 ring-bingo-tertiary" : ""}`}
              onClick={() => onToggleWinline(wl.id)}
            >
              {wl.name}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
