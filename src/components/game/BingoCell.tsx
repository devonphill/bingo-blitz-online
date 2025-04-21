
import React from "react";
import OneTouchAnimation from "./OneTouchAnimation";

export default function BingoCell({
  rowIndex,
  colIndex,
  value,
  marked,
  autoMarking,
  onClick,
  is1TG = false
}: {
  rowIndex: number,
  colIndex: number,
  value: number | null,
  marked: boolean,
  autoMarking: boolean,
  onClick: () => void,
  is1TG?: boolean
}) {
  return (
    <div
      className={`relative aspect-square flex items-center justify-center text-sm font-medium border rounded
        ${value !== null ? (autoMarking ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50') : 'bg-gray-100'}
        ${is1TG && !marked ? 'border-green-500 border-2' : ''}
      `}
      onClick={onClick}
      style={{
        overflow: "hidden",
        minHeight: 32,
        minWidth: 32,
        position: "relative"
      }}
      tabIndex={value !== null && !autoMarking ? 0 : -1}
      aria-pressed={marked}
    >
      {value !== null ? (
        <>
          <span
            className={`relative z-10 select-none ${marked ? "text-white font-bold" : is1TG ? "text-green-600 font-bold" : ""}`}
          >
            {value}
          </span>
          {marked && (
            <span
              className="absolute inset-0 z-20 flex items-center justify-center rounded bg-black"
              style={{ opacity: 0.6 }}
            />
          )}
          {is1TG && !marked && <OneTouchAnimation />}
        </>
      ) : ""}
    </div>
  );
}
