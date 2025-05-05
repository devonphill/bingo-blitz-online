
import { cn } from "@/lib/utils"

type SpinnerProps = {
  size?: "sm" | "md" | "lg"
  className?: string
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  const sizeClass = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  }
  
  return (
    <div className={cn(
      "animate-spin rounded-full border-4 border-slate-200", 
      "border-t-blue-600",
      sizeClass[size],
      className
    )}></div>
  )
}
