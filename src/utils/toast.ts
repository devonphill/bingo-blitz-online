
// Import directly from the components/ui file to avoid circular dependencies
import { toast as toastFunction } from "@/components/ui/use-toast";

// Re-export the toast function for easier access
export { toastFunction as toast };
