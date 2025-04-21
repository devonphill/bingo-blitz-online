
import React from "react";

export default function CurrentNumberDisplay({ number, sizePx = 90 }: { number: number | null, sizePx?: number }) {
  // Colors similar to CalledNumbers color mapping
  const getColor = (n: number | null) => {
    if (n == null) return "bg-gray-200 text-gray-400";
    if (n <= 9) return "bg-red-500";
    if (n <= 19) return "bg-yellow-500";
    if (n <= 29) return "bg-green-500";
    if (n <= 39) return "bg-blue-500";
    if (n <= 49) return "bg-indigo-500";
    if (n <= 59) return "bg-purple-500";
    if (n <= 69) return "bg-pink-500";
    if (n <= 79) return "bg-orange-500";
    return "bg-teal-500";
  };
  return (
    <div className="flex flex-col items-center justify-center w-full h-full" style={{height: sizePx, width: sizePx}}>
      <span className="mb-2 text-sm text-gray-500">Current Number</span>
      <div
        className={`flex items-center justify-center rounded-full shadow-lg ${getColor(number)} bingo-number-ball`}
        style={{ width: sizePx, height: sizePx, fontSize: sizePx * 0.25 + 24 }}
      >
        {number == null ? "--" : number}
      </div>
    </div>
  );
}
