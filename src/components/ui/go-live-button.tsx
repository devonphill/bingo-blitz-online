
import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSessionLifecycle } from "@/hooks/useSessionLifecycle"
import { Radio } from "lucide-react"

interface GoLiveButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  sessionId: string
  onSuccess?: () => void
  onError?: () => void
}

const GoLiveButton = React.forwardRef<HTMLButtonElement, GoLiveButtonProps>(
  ({ className, sessionId, onSuccess, onError, children, disabled, ...props }, ref) => {
    const { goLive, isUpdating } = useSessionLifecycle(sessionId)
    
    const handleGoLive = async () => {
      const success = await goLive()
      if (success && onSuccess) {
        onSuccess()
      } else if (!success && onError) {
        onError()
      }
    }
    
    // CRITICAL: Button is NEVER disabled by internal logic - only by the disabled prop
    return (
      <Button
        variant="default"
        className={cn(
          "bg-red-600 hover:bg-red-700 text-white font-medium flex items-center gap-2 transition-all duration-300",
          (isUpdating) && "opacity-80",
          className
        )}
        onClick={handleGoLive}
        disabled={disabled === true ? true : false} // Force explicit boolean evaluation
        ref={ref}
        {...props}
      >
        <Radio className="h-4 w-4 animate-pulse" />
        {children || (isUpdating ? "Going Live..." : "Go Live")}
      </Button>
    )
  }
)

GoLiveButton.displayName = "GoLiveButton"

export { GoLiveButton }
