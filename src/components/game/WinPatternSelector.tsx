
import React from "react";
import { Button } from "@/components/ui/button";

interface WinPatternSelectorProps {
  selectedPatterns: string[];
  onTogglePattern: (pattern: string) => void;
  prizeValues: Record<string, string>;
  onPrizeChange: (pattern: string, prize: string) => void;
}

const patterns = [
  { key: "oneLine", label: "One Line" },
  { key: "twoLines", label: "Two Lines" },
  { key: "fullHouse", label: "Full House" },
];

export default function WinPatternSelector({
  selectedPatterns,
  onTogglePattern,
  prizeValues,
  onPrizeChange,
}: WinPatternSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center mb-2 font-medium text-base">Win Patterns:</div>
      <div className="flex gap-4 mb-2">
        {patterns.map((pat) => (
          <div key={pat.key} className="flex items-center space-x-2">
            <Button
              type="button"
              size="sm"
              variant={selectedPatterns.includes(pat.key) ? "default" : "outline"}
              className={selectedPatterns.includes(pat.key) ? "bg-bingo-primary text-white" : ""}
              onClick={() => onTogglePattern(pat.key)}
            >
              {pat.label}
            </Button>
            <input
              type="text"
              placeholder="Prize"
              className="border rounded px-2 py-1 w-24 text-xs"
              value={prizeValues[pat.key] || ""}
              onChange={e => onPrizeChange(pat.key, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
