
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

interface CalledNumbersProps {
  calledNumbers: number[];
  currentNumber: number | null;
}

export default function CalledNumbers({ calledNumbers, currentNumber }: CalledNumbersProps) {
  // Sort the numbers for easier reference
  const sortedNumbers = [...calledNumbers].sort((a, b) => a - b);
  
  // Track state for animation
  const [animatingNumber, setAnimatingNumber] = useState<number | null>(null);
  const prevNumberRef = useRef<number | null>(null);
  const prevCalledCountRef = useRef<number>(0);
  
  useEffect(() => {
    // Check if we have a truly new number (not just a re-render)
    if (currentNumber !== null && 
       (currentNumber !== prevNumberRef.current || calledNumbers.length !== prevCalledCountRef.current)) {
      
      console.log("New number detected:", currentNumber, "Previous:", prevNumberRef.current);
      setAnimatingNumber(currentNumber);
      prevNumberRef.current = currentNumber;
      prevCalledCountRef.current = calledNumbers.length;
      
      // Reset animation after a delay
      const timer = setTimeout(() => {
        setAnimatingNumber(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [currentNumber, calledNumbers.length]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold flex items-center justify-between">
          <div>Called Numbers ({calledNumbers.length})</div>
          {currentNumber && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Last Called:</span>
              <motion.div
                key={`current-${currentNumber}`}
                initial={animatingNumber === currentNumber ? { scale: 1.2, backgroundColor: "#4ade80" } : {}}
                animate={animatingNumber === currentNumber ? 
                  { scale: 1, backgroundColor: "#f8fafc" } : 
                  { scale: 1 }
                }
                transition={{ duration: 1.5 }}
                className="rounded-full w-8 h-8 bg-gray-100 flex items-center justify-center font-bold border border-gray-300"
              >
                {currentNumber}
              </motion.div>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-10 gap-1 sm:gap-2">
          {Array.from({ length: 90 }, (_, i) => i + 1).map((number) => {
            const isCalled = sortedNumbers.includes(number);
            const isLastCalled = number === currentNumber;
            const isAnimating = number === animatingNumber;
            
            return (
              <motion.div
                key={`${number}-${isCalled}-${isLastCalled}`}
                initial={isAnimating ? { scale: 1.5, backgroundColor: "#4ade80" } : {}}
                animate={
                  isAnimating
                    ? { scale: 1, backgroundColor: isCalled ? "#0284c7" : "#f1f5f9" }
                    : {}
                }
                transition={{ duration: 1 }}
                className={`
                  w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm
                  ${isCalled ? 'bg-primary text-white font-bold' : 'bg-gray-100 text-gray-500'}
                  ${isLastCalled ? 'ring-2 ring-offset-2 ring-primary' : ''}
                `}
              >
                {number}
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
