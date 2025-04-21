
import React from "react";
import { CircleIcon } from "lucide-react";

export default function OneTouchAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
      <div className="animate-spin text-green-500">
        <CircleIcon size={28} className="animate-pulse" />
      </div>
    </div>
  );
}
