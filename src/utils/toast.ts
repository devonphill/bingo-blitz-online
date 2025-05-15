
// Import directly from the components/ui file to avoid circular dependencies
import { toast as useToast } from "@/components/ui/use-toast";

// Re-export the toast function for easier access
export const toast = useToast;
