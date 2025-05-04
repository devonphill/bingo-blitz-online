
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { logWithTimestamp } from "@/utils/logUtils";

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
    // Log for debugging
    logWithTimestamp(`CurrentNumberDisplay: Received number ${number}, prev was ${prevNumber}, isNew: ${isNew}`);
    
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
    if (n <= 15) return "bg-red-500 text-white";
    if (n <= 30) return "bg-yellow-500 text-white";
    if (n <= 45) return "bg-green-500 text-white";
    if (n <= 60) return "bg-blue-500 text-white";
    if (n <= 75) return "bg-indigo-500 text-white";
    if (n <= 90) return "bg-purple-500 text-white";
    return "bg-teal-500 text-white";
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <span className="text-lg text-gray-600 font-medium mb-3">Current Number</span>
      
      <AnimatePresence mode="wait">
        <motion.div
          // Add timestamp to force re-render on each number change
          key={`number-${number}-${Date.now()}`}
          initial={isNew ? { scale: 0.8, opacity: 0 } : { scale: 1, opacity: 1 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 20, 
            duration: 0.6 
          }}
          className={`flex items-center justify-center rounded-full shadow-lg ${getColor(number)} bingo-number-ball relative overflow-hidden`}
          style={{ 
            width: sizePx, 
            height: sizePx, 
            fontSize: sizePx * 0.4,
            boxShadow: number !== null ? '0 10px 25px -5px rgba(0, 0, 0, 0.2)' : 'none'
          }}
        >
          {/* Add subtle animated gradient overlay for more visual interest */}
          {number !== null && (
            <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-white to-transparent" />
          )}
          
          {/* The number itself */}
          <span className="font-bold relative z-10">
            {number == null ? "--" : number}
          </span>
        </motion.div>
      </AnimatePresence>
      
      {number !== null && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-4 text-sm font-medium text-gray-700 bg-white px-3 py-1 rounded-full shadow-sm"
        >
          Just called: {number}
        </motion.div>
      )}
    </div>
  );
}
