
import React from "react";

export default function BingoCell({
  rowIndex,
  colIndex,
  value,
  marked,
  autoMarking,
  onClick
}: {
  rowIndex: number,
  colIndex: number,
  value: number | null,
  marked: boolean,
  autoMarking: boolean,
  onClick: () => void
}) {
  return (
    <div
      className={`relative aspect-square flex items-center justify-center text-sm font-medium border rounded
        ${value !== null ? (autoMarking ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50') : 'bg-gray-100'}
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
            className={`relative z-10 select-none ${marked ? "text-white font-bold" : ""}`}
          >
            {value}
          </span>
          {marked && (
            <span
              className="absolute inset-0 z-20 flex items-center justify-center rounded bg-black"
              style={{ opacity: 0.6 }}
            />
          )}
        </>
      ) : ""}
    </div>
  );
}
