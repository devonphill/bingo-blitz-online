
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface CurrentNumberDisplayProps {
  number: number | null;
  sizePx?: number;
  gameType?: string;
  className?: string;
}

export default function CurrentNumberDisplay({ 
  number, 
  sizePx = 120,
  gameType = '90-ball',
  className = ""
}: CurrentNumberDisplayProps) {
  // Animated state to indicate new numbers
  const [isNew, setIsNew] = useState(false);
  const [prevNumber, setPrevNumber] = useState<number | null>(null);
  
  useEffect(() => {
    // Only animate when the number actually changes
    if (number !== null && number !== prevNumber) {
      setPrevNumber(number);
      setIsNew(true);
      
      // Reset animation state after animation completes
      const timer = setTimeout(() => {
        setIsNew(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [number, prevNumber]);

  // Colors similar to CalledNumbers color mapping
  const getColor = (n: number | null) => {
    if (n == null) return "bg-gray-200 text-gray-400";
    if (n <= 9) return "bg-red-500 text-white";
    if (n <= 19) return "bg-yellow-500 text-white";
    if (n <= 29) return "bg-green-500 text-white";
    if (n <= 39) return "bg-blue-500 text-white";
    if (n <= 49) return "bg-indigo-500 text-white";
    if (n <= 59) return "bg-purple-500 text-white";
    if (n <= 69) return "bg-pink-500 text-white";
    if (n <= 79) return "bg-orange-500 text-white";
    return "bg-teal-500 text-white";
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <span className="mb-2 text-sm text-gray-500">Current Number</span>
      <motion.div
        key={`number-${number}`}
        initial={isNew ? { scale: 1.5, opacity: 0.8 } : {}}
        animate={isNew ? { scale: 1, opacity: 1 } : {}}
        transition={{ duration: 1, type: "spring", stiffness: 100 }}
        className={`flex items-center justify-center rounded-full shadow-lg ${getColor(number)} bingo-number-ball`}
        style={{ width: sizePx, height: sizePx, fontSize: sizePx * 0.4 }}
      >
        {number == null ? "--" : number}
      </motion.div>
      {number !== null && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-sm font-medium text-gray-700"
        >
          Just called: {number}
        </motion.div>
      )}
    </div>
  );
}
