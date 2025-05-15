
import { useToast as useToastFromRadix } from "@/components/ui/toast";

// Re-export the useToast hook from Radix UI
export const useToast = useToastFromRadix;

// Export the toast function
export const toast = useToastFromRadix().toast;
