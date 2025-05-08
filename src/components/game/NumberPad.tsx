
import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NumberPadProps {
  onNumberSelect: (number: number) => void;
  selectedNumber: number | null;
  availableNumbers: number[];
  gameType?: string;
}

export default function NumberPad({
  onNumberSelect,
  selectedNumber,
  availableNumbers,
  gameType = "mainstage"
}: NumberPadProps) {
  // Default to 90 for mainstage (90-ball bingo)
  const maxNumber = gameType === "seventyfive" ? 75 : 90;
  
  // Create an array of numbers from 1 to maxNumber
  const allNumbers = Array.from({ length: maxNumber }, (_, i) => i + 1);
  
  return (
    <div className="grid grid-cols-5 gap-2">
      {allNumbers.map((num) => {
        const isAvailable = availableNumbers.includes(num);
        const isSelected = selectedNumber === num;
        
        return (
          <Button
            key={num}
            size="sm"
            variant={isSelected ? "default" : "outline"}
            onClick={() => isAvailable && onNumberSelect(num)}
            disabled={!isAvailable}
            className={cn(
              "aspect-square p-0 flex items-center justify-center",
              !isAvailable && "bg-gray-100 text-gray-400 border-gray-200",
              isSelected && "bg-blue-600 text-white"
            )}
          >
            {num}
          </Button>
        );
      })}
    </div>
  );
}
